/**
 * Sachet - MVC in a "just whats needed" package.
 *
 * Author: Lakshmi Vyasarajan (@lakshmivyas)
 *
 * License: MIT
 *
 * Portions of this (views and event handling in particular) are
 * completely copied from backbone.js, while others are
 * heavily inspired by it.
 *
 * http://backbonejs.org
 * (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
 *
 * Version 0.0.1
 * Updated: 10, Oct 2012
 *
 */
/*global $:true, request:true, dust:true, jQuery: true, localStorage: true*/

(function () {
    "use strict";
    // Compatibility
    //

    // Add `keys` function if its not natively available
    if (!Object.keys) {
        Object.keys = function (o) {
            if (o !== Object(o)) {
                throw new TypeError('Object.keys called on a non-object');
            }
            var k = [], p;
            for (p in o) {
                if (Object.prototype.hasOwnProperty.call(o, p)) {
                    k.push(p);
                }
            }
            return k;
        };

    }

    // Add `bind` function if its not natively available
    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                  fToBind = this,
                  FNOP = function () {},
                  FBound = function () {
                    return fToBind.apply(
                        this instanceof FNOP && oThis ? this : oThis,
                                       aArgs.concat(Array.prototype.slice.call(arguments)));
                };

            FNOP.prototype = this.prototype;
            FBound.prototype = new FNOP();

            return FBound;
        };
    }

    var root = this;

    // The `Sachet` namespace
    var Sachet = root.Sachet = {};

    Sachet.parseParams = function () {
        var
            queryPair,
            spacer = /\+/g,  // Regex for replacing addition symbol with a space
            reg = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(spacer, " ")); },
            query = window.location.search.substring(1),
            paramName,
            paramValue,
            params = {};
        while ((queryPair = reg.exec(query))) {
            paramName = queryPair[1];
            paramValue = queryPair[2];
            params[decode(paramName)] = decode(paramValue);
        }
        Sachet.params = params;
    };
    Sachet.parseParams();

    Sachet.rankAndSort = function (collection, rankers, sorter) {
        var     results = []
            ,   rankMap = {};

        function ranker(value) {
            var result = -1;
            $.each(rankers, function (index, ranker) {
                if (ranker(value)) {
                    result = index;
                    return false;
                }
            });
            return result;
        }

        $.each(collection, function (index, value) {
            if ($.inArray(value, results) >= 0) {
                return true;
            }
            var rank = ranker(value);
            if (rank >= 0) {
                rankMap[value] = rank;
                results.push(value);
            }
        });
        results.sort(function (v1, v2) {
            var     rank1 = rankMap[v1]
                ,   rank2 = rankMap[v2];

            if (sorter && rank1 === rank2) {
                return sorter(v1, v2);
            }
            return rank1 === rank2 ? 0 : (rank1 > rank2 ? 1 : -1);
        });
        return results;
    };

    /**
     * An abstraction for storing key values on
     * the client side.
     * @param {object} defaults Values here are passed
     * by default to the storage as options.
     * @param {string} type 'local' or 'cookies' for the moment.
     */
    Sachet.Keystore = function (defaults, type) {

        this.defaults = defaults;
        this.type = type;

        // Create the appropriate storage based on the type parameter.
        this.store = (type !== 'local') ?
                    new Sachet.Keystore.Cookies() : new Sachet.Keystore.Local();

        /**
         * Gets the value for the given key.
         * @param  {string} key The key to lookup.
         * @param  {object} options Options to be passed to
         * the storage. This extends the `defaults` sent during
         * construction. If `prefix` is provided as an option,
         * a prefixed key is sent to the store.
         * @return {any} The looked up value or `undefined`
         */
        this.get = function (key, options) {
            options = $.extend({}, this.defaults, options);
            if (options.prefix) {
                key = options.prefix + '.' + key;
            }
            return this.store.get(key, options);
        };

        /**
         * Sets the value for the given key.
         * @param {string} key  The key to set a value for.
         * @param {any} value The value to be set.
         * @param {object} options
         */
        this.set = function (key, value, options) {
            options = $.extend({}, this.defaults, options);
            if (options.prefix) {
                key = options.prefix + '.' + key;
            }
            return this.store.set(key, value, options);
        };

        /**
         * Removes the given key from the storage.
         * @param  {string} key The key to be removed
         * @param  {object} options
         */
        this.remove = function (key, options) {
            options = $.extend({}, this.defaults, options);
            if (options.prefix) {
                key = options.prefix + '.' + key;
            }
            return this.store.remove(key, options);
        };
    };

    /**
     * The Cookie store. Uses the jQuery cookie plugin.
     */
    Sachet.Keystore.Cookies  = function () {

        this.get = function (key, options) {
            return $.cookie(key, options);
        };

        this.set = function (key, value, options) {
            $.cookie(key, value, options);
        };

        this.remove = function (key, options) {
            // Send `null` to remove the cookie.
            $.cookie(key, null, options);
        };
    };

    /**
     * Localstorage store.
     */
    Sachet.Keystore.Local  = function () {

        this.get = function (key) {
            return localStorage[key];
        };

        this.set = function (key, value) {
            localStorage[key] = value;
        };

        this.remove = function (key) {
            localStorage.removeItem(key);
        };
    };

    /////////////////////////////////////////////////////////////////////////////
    // Begin lifting code from backbone.js
    // (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
    //
    //

    /**
     * Shortcut function for checking if an object has a given property
     * directly on itself (in other words, not on a prototype).
     */
    Sachet.has = function (obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    };

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    Sachet.extend = function (protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && Sachet.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function () { parent.apply(this, arguments); };
        }

        // Add static properties to the constructor function, if supplied.
        $.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function () { this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate();

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) {
            $.extend(child.prototype, protoProps);
        }

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };
    // End lifting code from backbone.js
    // (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
    ///////////////////////////////////////////////////////////////////////////


 /**
     * Global unique id counter
     * @type {Number}
     */
    Sachet.idCounter = 0;

    /**
     * Increments the global unique id counter and
     * returns an id with a prefix if provided.
     * @param  {string} prefix Prefix for context.
     * @return {string}  An unique id with the prefix.
     */
    Sachet.uniqueId = function (prefix) {
        var id = Sachet.idCounter++;
        prefix = prefix || 'i';
        return prefix + id;
    };

    /**
     * If the given attribute name points to  a function,
     * executes it to provide the result.
     * Otherwise, returns the value.
     * @param  {object} object The container.
     * @param  {string} attr The name of the attribute to be evaluated.
     * @return {any} The result.
     */
    Sachet.result = function (object, attr) {
        if (object === null) return null;
        var value = object[attr];
        return $.isFunction(value) ? value.call(object) : value;
    };

    /**
     * Make a promise from the given value.
     *
     * Evaluates the value and returns an
     * appropriate promise object.
     *
     * @param  {any} result The value to convert to a promise.
     * @return {Promise}
     */
    Sachet.makePromise = function (result) {
        // If its already a promise object, there is nothing more to do.
        if (!result.promise) {
            var newResult = $.Deferred();

            // Evaluate truthfulness
            // If its an object, it needs to have a `success` attribute
            // that evaluates to true.
            // Otherwise, the value must be truth-y.
            if ($.isObject(result)) {
                if (result.success) {
                    newResult.resolveWith(this, result);
                } else {
                    newResult.rejectWith(this, result);
                }
            } else if (result) {
                newResult.resolveWith(this, result);
            } else {
                newResult.rejectWith(this, result);
            }
            result = newResult.promise();
        }
        return result;
    };

    /**
     * `Sachet` root object that namespaces a few
     * utility methods.
     */
    Sachet.Object = function () {
        // To check of this is an instance of a Sachet object.
        //
        this.Sachet = Sachet;
        this.params = Sachet.params;

        // Convenience. Last argument is always `options`.
        if (arguments.length > 0 && arguments.slice) {
            this.options = arguments.slice(-1)[0];
        } else {
            this.options = {};
        }

        // A replacement constructor to be provided with
        // `extend` calls.
        this.init.apply(this, arguments);
    };

    Sachet.Object.extend = Sachet.extend;

    /**
     * Subclasses override this to provide construction code.
     * Does nothing by default.
     */
    Sachet.Object.prototype.init = function () {};

    /**
     * Get the key store.
     * @return {object} The default keystore.
     */
    Sachet.Object.prototype.store = function () {
        return Sachet.store;
    };


    /////////////////////////////////////////////////////////////////////////////
    // Begin lifting code from backbone.js
    // (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.

    // Regular expression used to split event strings
    var eventSplitter = /\s+/;

    /**
     * Observable objects. Allow `on`, `off` and `trigger`
     * calls for custom events.
     *
     */
    Sachet.Observable = Sachet.Object.extend({
        /*jshint boss:true */

        // Bind one or more space separated events, `events`, to a `callback`
        // function. Passing `"all"` will bind the callback to all events fired.
        on: function (events, callback, context) {
            var calls, event, list;
            if (!callback) return this;

            events = events.split(eventSplitter);
            calls = this._callbacks || (this._callbacks = {});

            while (event = events.shift()) {
                list = calls[event] || (calls[event] = []);
                list.push(callback, context);
            }
            return this;
        },

        // Remove one or many callbacks. If `context` is null, removes all callbacks
        // with that function. If `callback` is null, removes all callbacks for the
        // event. If `events` is null, removes all bound callbacks for all events.
        off: function (events, callback, context) {
            var event, calls, list, i;

            // No events, or removing *all* events.
            if (!(calls = this._callbacks)) return this;
            if (!(events || callback || context)) {
                delete this._callbacks;
                return this;
            }

            events = events ? events.split(eventSplitter) : Object.keys(calls);

            // Loop through the callback list, splicing where appropriate.
            while (event = events.shift()) {
                if (!(list = calls[event]) || !(callback || context)) {
                    delete calls[event];
                    continue;
                }

                for (i = list.length - 2; i >= 0; i -= 2) {
                    if (!(callback && list[i] !== callback || context && list[i + 1] !== context)) {
                        list.splice(i, 2);
                    }
                }
            }

            return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function (events) {
            var event, calls, list, i, length, args, all, rest;
            if (!(calls = this._callbacks)) return this;

            rest = [];
            events = events.split(eventSplitter);

            // Fill up `rest` with the callback arguments.  Since we're only copying
            // the tail of `arguments`, a loop is much faster than Array#slice.
            for (i = 1, length = arguments.length; i < length; i++) {
                rest[i - 1] = arguments[i];
            }

            // For each event, walk through the list of callbacks twice, first to
            // trigger the event, then to trigger any `"all"` callbacks.
            while (event = events.shift()) {
                // Copy callback lists to prevent modification.
                if (all = calls.all) all = all.slice();
                if (list = calls[event]) list = list.slice();

                // Execute event callbacks.
                if (list) {
                    for (i = 0, length = list.length; i < length; i += 2) {
                        list[i].apply(list[i + 1] || this, rest);
                    }
                }

                // Execute "all" callbacks.
                if (all) {
                    args = [event].concat(rest);
                    for (i = 0, length = all.length; i < length; i += 2) {
                        all[i].apply(all[i + 1] || this, args);
                    }
                }
            }

            return this;
        }

    });
    //
    // End lifting code from backbone.js
    // (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
    ///////////////////////////////////////////////////////////////////////////

    /**
     * Base Formatter class. Does no formatting by default.
     * @type {class}
     */
    var Formatter = Sachet.Formatter = Sachet.Object.extend({

        /**
         * Constructor.
         * @param  {object} field The field object to be formatted.
         */
        init: function (field) {
            this.field = field;
            this.isFormatter = true;
        },

        /**
         * Returns the formatted value. This method must
         * be overridden. Returns the value as is by default.
         * @return {any} Formatted value.
         */
        format: function () {
            return this.field.get();
        }
    });

    /**
     * Helper function to create a formatter class given
     * a format function.
     * @param  {Function} fn Function that formats the field value.
     * @return {class} A new Formatter class.
     */
    Formatter.make = function (fn) {
        return Formatter.extend({
            format: function () {
                return fn.call(this);
            }
        });
    };

    /**
     * Base Validator class. Passes validation by default.
     * @type {class}
     */
    var Validator = Sachet.Validator = Sachet.Observable.extend({
        init: function (field) {
            this.field = field;
            this.isValidator = true;

            // If this is setup to validate automatically
            // on change, subscribe to the field change
            // event.
            if (this.options.validateOnChange) {
                field.on('change', this.validate);

                // If this is an object validator, where
                // validity of this field depends on other
                // fields in the model, subscribe to the model
                // change event as well
                if (this.options.validateEntireObject) {
                    field.model.on('change', this.validate);
                }
            }
            // Mark the field as pending validation.
            field.isValid = undefined;
        },

        /**
         * The validation entry point.
         * @return {Promise}
         */
        validate: function () {
            var validator = this;
            this.field.isValid = undefined;

            // Delegate to the onValidate method.
            var result = Sachet.makePromise(this.onValidate());

            // Ensure success / error methods are called appropriately.
            return result.pipe(validator.success, validator.error);
        },

        /**
         * The validation handler. Overridden by the subclasses.
         * @return {any} truth-y, false-y or Promise.
         */
        onValidate: function () {
            // All is well.
            return $.Deferred().resolveWith(this).promise();
        },

        /**
         * Validation success handler.
         */
        success: function () {
            this.errorData = null;
            this.field.isValid = true;
            this.field.trigger('valid');
        },

        /**
         * Validation error handler.
         * @param  {object} data Error data.
         */
        error: function (data) {
            this.field.isValid = false;
            this.errorData = data;
            this.field.trigger('error');
        }

    });

    /**
     * Helper function to create a new type of `Validator`
     * by just providing the validation function.
     * @param  {Function} fn The `onValidate` function.
     */
    Validator.make = function (fn) {
        return Validator.extend({
            onValidate: function () {
                return fn.call(this);
            }
        });
    };

    /**
     * Allows chaining multiple validators for one field.
     */
    Sachet.CompositeValidator = Validator.extend({

        /**
         * Constructor.
         * @param  {array} validators The list of validators to compose.
         */
        init: function (field, validators) {
            this.validators  = validators || [];
            Sachet.Validator.prototype.init.apply(this, arguments);
        },

        /**
         * Composes the results from the given validators and
         * presents a singular front.
         * @return {Promise or any}
         */
        onValidate: function () {
            var validator = this;
            // Cache the responses from individual validators.
            var responses = [];

            // Call onValidate on each of the validators.
            $.each(this.validators, function (i, validator) {
                responses.push(Sachet.makePromise(validator.onValidate()));
            });

            // Evaluate the responses from all the validators.
            var result = $.Deferred();
            $.when(responses).done(function () {
                result.resolveWith(validator);
            }).fail(function (error) {
                result.rejectWith(validator, error);
            });
            return result;
        }
    });


    Sachet.Validators = Sachet.Validators || {};

    /**
     * Required field validator.
     * @return {Bool} True if value is not empty. False otherwise.
     */
    Sachet.Validators.Required = Sachet.Validator.make(function () {
        var val = this.field.get();

        // Empty object is invalid.
        if ($.isPlainObject(val)) {
            return $.isEmptyObject(val) === false;
        } else if (typeof(val) === 'string') {
            // Empty string is invalid.
            return $.trim(val).length > 0;
        } else {
            // null is invalid.
            return !!val;
        }
    });

    /**
     * The service class for interfacing with RPC type services.
     */
    Sachet.Service = Sachet.Observable.extend({

        /**
         * Constructor.
         * @param  {string} baseurl The service end point.
         * @param  {string} path The service path.
         */
        init: function (baseurl, path) {
            this.isService = true;
            this.baseurl = baseurl;
            this.path = path;
            this.defaults = {
                headers: {
                    'accept': 'application/json'
                },
                data: {}
            };
        },

        /**
         * Returns the url for calling this service.
         * @param  {object} options Overrides for getting the url.
         * @return {string} The url for calling this service.
         */
        url: function (options)  {
            var defaults = {
                baseurl: this.baseurl,
                path: this.path
            };
            options = $.extend({}, defaults, options);
            return options.baseurl + options.path;
        },

        /**
         * Calls the remote server.
         * @param  {object} options Overrides for the service call options.
         * @return {Promise}
         */
        rpc: function (options) {
            var service = this;
            options = $.extend({}, this.defaults, options);
            var     result = $.Deferred()
                ,   method = options.method || 'GET'
                ,   data = $.extend({}, this.data, options.data)
                ,   headers = $.extend({}, this.headers, options.headers)
                ,   url = $.isFunction(options.url) ? options.url : this.url
                ,   r = request(method, url.call(this, options));

            if (!$.isEmptyObject(data)) {
                r.send(data);
            }
            if (!$.isEmptyObject(headers)) {
                r.set(headers);
            }
            r.end(function (res) {
                var body = res.body || JSON.parse(res.text || '{}');
                if (res.ok) {
                    result.resolve(service.parse(body));
                } else {
                    result.reject(service.error(body));
                }
            });
            return result.promise();
        },

        /**
         * Parses the data from remote service call.
         * @param  {object} data Data from the remote call.
         * @return {any} parsed result.
         */
        parse: function (data) {
            return this.model ? new this.model(data) : data;
        },

        /**
         * Parses the error data and handles the error.
         * @param  {object} data Error data.
         * @return {any}
         */
        error: function (data) {
            return data;
        }

    });

    Sachet.Service.make = function (options) {
        var service = this;
        var NewService = service.extend({
            init: function () {
                service.prototype.init.call(this, options.baseurl, options.path);
                this.model = options.model || false;
            }
        });
        return NewService;
    };

    /**
     * The resource class for interfacing with Restful services.
     */
    Sachet.Resource = Sachet.Observable.extend({

        /**
         * Constructor.
         * @param  {string} baseurl The resource end point.
         * @param  {string} collectionName The resource endpoint.
         */
        init: function (baseurl, collectionName) {
            this.isResource = true;
            this.baseurl = baseurl;
            this.collectionName = collectionName;
            this.service = new Sachet.Service(baseurl, collectionName);
        },

        get: function (options) {
            return this.service.rpc(options);
        },

        put: function (options) {
            return this.service.rpc($.extend({}, {
                method: 'PUT',
                url: function (options) {
                    return this.url(options) + '/' + options.resourceName;
                }
            }, options));
        },

        post: function (options) {
            return this.service.rpc($.extend({}, {method: 'POST'}, options));
        },

        patch: function (options) {
            return this.service.rpc($.extend({}, {
                method: 'PATCH',
                url: function (options) {
                    return this.url(options) + '/' + options.resourceName;
                }
            }, options));
        },

        del: function (options) {
            return this.service.rpc($.extend({}, {
                method: 'DELETE',
                url: function (options) {
                    return this.url(options) + '/' + options.resourceName;
                }
            }, options));
        }
    });

    Sachet.Resource.make = function (options) {
        var resource = this;
        var NewResource = resource.extend({
            init: function () {
                resource.prototype.init.call(this, options.baseurl, options.collectionName);
                this.model = options.model || false;
            }
        });
        return NewResource;
    };

    /**
     * Represents a model attribute. Provides support for
     * validation and formatting.
     */
    var Field = Sachet.Field = Sachet.Observable.extend({

        /**
         * Constructor.
         */
        init: function () {
            this.options = this.options || {};
            this.isField = true;
            this.model = this.options.model;
            this._default = this.options.defaultValue;
            this._value = this._default;
            this.formatter = this.options.formatter || Formatter;
            this.validator = this.options.validator || Validator;
        },

        /**
         * Gets the field value. Returns the default value if empty.
         * @return {any}
         */
        get: function () {
            return this._value;
        },

        /**
         * Returns the formatted representation of the field.
         *
         * Uses the formatter provided during construction.
         * @return {any}
         */
        formatted: function () {
            return this.formatter.format();
        },

        /**
         * Sets the value for the field.
         * @param {any} value The new value.
         */
        set: function (value) {
            this._value = value;
            this.isValid = undefined;
        },

        /**
         * Clears the field value and restores the default.
         */
        clear: function() {
            this._value = this._default;
            this.isValid = undefined;
        },

        /**
         * Calls the validator.
         * @return {Promise}
         */
        validate: function () {
            return this.validator.validate();
        },

        /**
         * Has the field been validated?
         * @return {Boolean}
         */
        isValidated: function () {
            return this.isValid !== undefined;
        },

        /**
         * Return the original value (before changes).
         * @return {any}
         */
        original: function () {
            return this._baseline;
        },

        /**
         * Make the current value the original value.
         * (Accept all changes)
         * @return {any}
         */
        makeOriginal: function () {
            this._baseline = this._value;
        }
    });

    /**
     * Creates a new field object with the given options.
     * @param  {object} options The default options to use.
     * @return {object} The new field object.
     */
    Field.spec = function (options) {
        var F = this;
        var NewField = F.extend({
            init: function () {
                this.options = $.extend({}, this.options, options);
                F.prototype.init.call(this);
            }
        });
        return NewField;
    };

    /**
     * Represents a list attribute.
     */
    Sachet.ListField = Sachet.Field.extend({

        /**
         * Constructor.
         * @param  {type} fieldType The type of field. A `Sachet.Field` class.
         */
        init: function () {
            Sachet.Field.prototype.init.call(this);
            this.isListField = true;
            this.fields = [];
            this.fieldType = this.options.fieldType || Sachet.Field;
        },

        /**
         * Gets the field value. Returns the default value if empty.
         * @return {any}
         */
        get: function () {
            var data = [];
            $.each(this.fields, function (i, field) {
                data.push(field.get());
            });
            return data;
        },

        /**
         * Returns the formatted representation of the field.
         *
         * Uses the formatter provided during construction.
         * @return {any}
         */
        formatted: function () {
            var data = [];
            $.each(this.fields, function (i, field) {
                data.push(field.formatted());
            });
            return data;
        },

        /**
         * Sets the value for the field.
         * @param {array(any)} value The new value.
         */
        set: function (value) {
            var list = this;
            this.fields = [];
            $.each(value, function (i, item) {
                list.add(item);
            });
        },

        /**
         * Adds a new value to the list.
         * @param {any} value The value to add.
         */
        add: function (value) {
            var list = this;
            if (value.isField) {
                return this.add(value.get());
            }
            var field = new list.fieldType(this.options);
            field.model = this.model;
            field.set(value);
            this.fields.push(field);
        },

        /**
         * Removes a value from the list.
         * @param {any} value The value to add.
         */
        remove: function (value) {
            if (value.isField) {
                value = value.get();
            }
            var fields = [];
            $.each(this.fields, function (i, field) {
                if (field.get() !== value) {
                    fields.push(field);
                }
            });
            this.fields = fields;
        },

        /**
         * Calls the validator.
         * @return {Promise}
         */
        validate: function () {
            var list = this;
            var responses = [];
            $.each(this.fields, function (i, field) {
                responses.push(field.validate());
            });
            var result = $.Deferred();
            $.when(responses).done(function () {
                list.isValid = true;
                result.resolve(this);
            }).fail(function () {
                list.isValid = false;
                result.reject(this);
            });
            return result.promise();
        },

        /**
         * Return the original value (before changes).
         * @return {any}
         */
        original: function () {
            return this._baseline;
        },

        /**
         * Make the current value the original value.
         * (Accept all changes)
         * @return {any}
         */
        makeOriginal: function () {
            this._baseline = this.get();
        }
    });

    /**
     * Represents a hash attribute.
     */
    Sachet.HashField = Sachet.Field.extend({

        /**
         * Constructor.
         * @param  {type} fieldType The type of field. A `Sachet.Field` class.
         */
        init: function () {
            Sachet.Field.prototype.init.call(this);
            this.isHashField = true;
            this.fields = {};
            this.keyFieldType = this.options.keyFieldType || Sachet.Field;
            this.valueFieldType = this.options.valueFieldType || Sachet.Field;
        },

        /**
         * Gets the field value. Returns the default value if empty.
         * @return {any}
         */
        get: function () {
            var data = {};
            $.each(this.fields, function (keyField, valueField) {
                data[keyField.get()] = valueField.get();
            });
            return data;
        },

        /**
         * Gets the keys in the object as a list.
         * @return {array} An array of keys.
         */
        keys: function () {
            var keys = {};
            $.each(this.fields, function (keyField) {
                keys.push(keyField.get());
            });
            return keys;
        },

        /**
         * Returns the formatted representation of the field.
         *
         * Uses the formatter provided during construction.
         * @return {any}
         */
        formatted: function () {
            var data = {};
            $.each(this.fields, function (keyField, valueField) {
                data[keyField.formatted()] = valueField.formatted();
            });
            return data;
        },

        /**
         * Sets the value for the field.
         * @param {array(any)} value The new value.
         */
        set: function (value) {
            var hash = this;
            this.fields = {};
            $.each(value, function (key, value) {
                hash.add(key, value);
            });
        },

        /**
         * Adds a new value to the list.
         * @param {any} key The key to add.
         * @param {any} value The value to add.
         */
        add: function (key, value) {
            var list = this;
            key = key.isField ? key.get() : key;
            value = value.isField ? value.get() : value;
            var keyField = new list.keyFieldType(this.options);
            var valueField = new list.valueFieldType(this.options);
            keyField.model = this.model;
            valueField.model = this.model;
            keyField.set(key);
            valueField.set(value);
            this.fields[keyField] = valueField;
        },

        /**
         * Removes a key from the list.
         * @param {any} value The value to add.
         */
        remove: function (key) {
            if (key.isField) {
                key = key.get();
            }
            var keyField = null;
            $.each(this.fields, function (keyField) {
                if (keyField.get() === key) return false;
            });
            if (keyField) {
                delete this.fields[keyField];
            }
        },

        /**
         * Calls the validator.
         * @return {Promise}
         */
        validate: function () {
            var hash = this;
            var responses = {};
            $.each(this.fields, function (keyField, valueField) {
                responses[keyField.get()] = valueField.validate();
            });
            var result = $.Deferred();
            $.when(responses).done(function () {
                hash.isValid = true;
                result.resolve(this);
            }).fail(function () {
                hash.isValid = false;
                result.reject(this);
            });
            return result.promise();
        },

        /**
         * Return the original value (before changes).
         * @return {any}
         */
        original: function () {
            return this._baseline;
        },

        /**
         * Make the current value the original value.
         * (Accept all changes)
         * @return {any}
         */
        makeOriginal: function () {
            this._baseline = this.get();
        }
    });

    /**
     * The base model object.
     */
    var Model = Sachet.Model = Field.extend({

        /**
         * Constructor
         * @param  {object} parent The parent model object.
         * @param  {object} obj  Attributes and values.
         */
        init: function (parent, obj) {
            if (!obj) {
                obj = parent;
                parent = null;
            }
            Sachet.Field.prototype.init.call(this, parent, {}, this.options);
            this.isModel = true;
            if (obj) {
                this.set(obj);
            }
        },

        /**
         * Gets this model's value. Aggregates the field values
         * and returns a plan JSON object.
         * @return {object}
         */
        get: function () {
            var data = {};
            $.each(this.fields, function (name, field) {
                data[name] = field.get();
            });
            return data;
        },


        /**
         * Clears the model and restores default field values.
         */
        clear: function() {
            $.each(this.fields, function (name, field) {
               field.clear();
            });
        },

        /**
         * Gets the formatted data for this model. Aggregates the
         * formatted value of its fields.
         * @return {object}
         */
        formatted: function () {
            var data = {};
            $.each(this.fields, function (name, field) {
                data[name] = field.formatted();
            });
            return data;
        },

        /**
         * Validates the model by aggregated validation of the
         * composed fields.
         * @return {Promise}
         */
        validate: function () {
            var model = this;
            var responses = [];
            $.each(this.fields, function (name, field) {
                responses.push(field.validate());
            });
            var result = $.Deferred();
            $.when(responses).done(function () {
                model.isValid = true;
                result.resolve(this);
            }).fail(function () {
                model.isValid = false;
                result.reject(this);
            });
            return result.promise();
        },

        /**
         * Sets the field values from the given object.
         * @param {object} obj Object to get the new values from.
         */
        set: function (obj) {
            $.each(this.fields, function (name, field) {
                field.set(obj[name]);
            });
            this.isValid = undefined;
        }

    });

    /**
     * Creates a new model class with the specified fields.
     * @param  {object} fields The fields that are contained the model. This
     * can be a map of objects or Fields or a mix.
     * @return {[type]}
     */
    Model.spec = function (fields) {
        var M = this;
        var NewModel = Model.extend({
            init: function (parent, obj) {
                var _fields = {};
                $.each(fields, function (name, obj) {
                    var field = obj;
                    if (!obj.isField) {
                        // Create a new Field from the given object.
                        field = new Field(NewModel, obj.defaultValue, obj);
                    }
                    _fields[name] = field;
                });
                this.fields = $.extend({}, this.fields, _fields);
                M.prototype.init.call(this, parent, obj);
            }
        });
        return NewModel;
    };

    /////////////////////////////////////////////////////////////////////////////
    // Begin lifting code from backbone.js
    // (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.

    // Cached regex to split keys for `delegate`.
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    // List of view options to be merged as properties.
    var viewOptions = ['model', 'el', 'id', 'attributes', 'className', 'tagName'];

    /**
     * Basic view object.
     */
    var View = Sachet.View = Sachet.Observable.extend({

        // The default `tagName` of a View's element is `"div"`.
        tagName: 'div',

        /**
         * Constructor.
         */
        init: function (options) {
            this.cid = Sachet.uniqueId('view');
            this._configure(options);
            this._ensureElement();
            this.delegateEvents();
        },


        /**
         * Called when the view is being updated. The element
         * is faded a little bit.
         */
        beginAction: function () {
            this.$el.animate({opacity: 0.5}, 500);
        },

        /**
         * Called when the view is done updating. The element
         * is brought back to full visibility.
         */
        endAction: function () {
            this.$el.animate({opacity: 1}, 'fast');
        },

        /**
         * Gets the element to populate.
         * @return {object} The element to be filled.
         */
        elementForView: function () {
            return this.$el;
        },

        /**
         * Gets the data for rendering a view.
         * @return {object} Whats needed to be displayed in the view.
         */
        dataForView: function () {
            return this.model ? this.model.get() : {};
        },

        /**
         * Renders the view.
         * @return {object} This object
         */
        render: function () {
            var result;
            var data = this.dataForView();
            dust.render(this.template, data, function (err, out) {
                result = out;
            });
            var $el = this.elementForView();
            $el.html(result);
            return this;
        },

        // jQuery delegate for element lookup, scoped to DOM elements within the
        // current view. This should be preferred to global lookups where possible.
        $: function (selector) {
            return this.$el.find(selector);
        },

        // Clean up references to this view in order to prevent latent effects and
        // memory leaks.
        dispose: function () {
            this.undelegateEvents();
            if (this.model && this.model.off) this.model.off(null, null, this);
            return this;
        },

        // Remove this view from the DOM. Note that the view isn't present in the
        // DOM by default, so calling this method may be a no-op.
        remove: function () {
            this.dispose();
            this.$el.remove();
            return this;
        },

        // For small amounts of DOM Elements, where a full-blown template isn't
        // needed, use **make** to manufacture elements, one at a time.
        //
        //     var el = this.make('li', {'class': 'row'}, this.model.escape('title'));
        //
        make: function (tagName, attributes, content) {
            var el = document.createElement(tagName);
            if (attributes) $(el).attr(attributes);
            if (content !== null) $(el).html(content);
            return el;
        },

        // Change the view's element (`this.el` property), including event
        // re-delegation.
        setElement: function (element, delegate) {
            if (this.$el) this.undelegateEvents();
            this.$el = element instanceof jQuery ? element : $(element);
            this.el = this.$el[0];
            if (delegate !== false) this.delegateEvents();
            return this;
        },

        // Set callbacks, where `this.events` is a hash of
        //
        // *{"event selector": "callback"}*
        //
        //     {
        //       'mousedown .title':  'edit',
        //       'click .button':     'save'
        //       'click .open':       function (e) { ... }
        //     }
        //
        // pairs. Callbacks will be bound to the view, with `this` set properly.
        // Uses event delegation for efficiency.
        // Omitting the selector binds the event to `this.el`.
        // This only works for delegate-able events: not `focus`, `blur`, and
        // not `change`, `submit`, and `reset` in Internet Explorer.
        delegateEvents: function (events) {
            if (!(events || (events = Sachet.result(this, 'events')))) return;
            this.undelegateEvents();
            for (var key in events) {
                var method = events[key];
                if (!$.isFunction(method)) method = this[events[key]];
                if (!method) throw new Error('Method "' + events[key] + '" does not exist');
                var match = key.match(delegateEventSplitter);
                var eventName = match[1], selector = match[2];
                method = method.bind(this);
                eventName += '.delegateEvents' + this.cid;
                if (selector === '') {
                    this.$el.bind(eventName, method);
                } else {
                    this.$el.delegate(selector, eventName, method);
                }
            }
        },

        // Clears all callbacks previously bound to the view with `delegateEvents`.
        // You usually don't need to use this, but may wish to if you have multiple
        // views attached to the same DOM element.
        undelegateEvents: function () {
            this.$el.unbind('.delegateEvents' + this.cid);
        },

        // Performs the initial configuration of a View with a set of options.
        // Keys with special meaning *(model, collection, id, className)*, are
        // attached directly to the view.
        _configure: function (options) {
            if (this.options) options = $.extend({}, this.options, options);
            for (var i = 0, l = viewOptions.length; i < l; i++) {
                var attr = viewOptions[i];
                if (options[attr]) this[attr] = options[attr];
            }
            this.options = options;
        },

        // Ensure that the View has a DOM element to render into.
        // If `this.el` is a string, pass it through `$()`, take the first
        // matching element, and re-assign it to `el`. Otherwise, create
        // an element from the `id`, `className` and `tagName` properties.
        _ensureElement: function () {
            if (!this.el) {
                var attrs = $.extend({}, Sachet.result(this, 'attributes'));
                if (this.id) attrs.id = Sachet.result(this, 'id');
                if (this.className) attrs['class'] = Sachet.result(this, 'className');
                this.setElement(this.make(Sachet.result(this, 'tagName'), attrs), false);
            } else {
                this.setElement(Sachet.result(this, 'el'), false);
            }
        }

    });

    //
    // End lifting code from backbone.js
    // (c) 2010-2012 Jeremy Ashkenas, DocumentCloud Inc.
    ///////////////////////////////////////////////////////////////////////////

    /**
     * A view that can be swapped with a different one based on the
     * application state.
     */
    Sachet.SwappableView = View.extend({

        /**
         * Constructor. Initializes the container.
         */
        init: function () {
            Sachet.View.prototype.init.apply(this, arguments);
            this.$container = $(this.options.container || this.container || '#container');
        },

        /**
         * Shows the view element.
         */
        show: function () {
            this.$el.show();
        },

        /**
         * Hides the view element.
         */
        hide: function () {
            this.$el.hide();
        },

        /**
         * If the element is already present, simply shows the view.
         * Otherwise renders the element by calling the renderView method.
         * @return {object} This object.
         */
        render: function () {
            if (this.$el && this.$el.length &&
                this.$el.closest('body').length) {
                this.show();
            } else {
                this.setElement(this.renderView());
                this.$container.append(this.$el);
            }
            return this;
        },

        /**
         * Responsible for rendering the view.
         * @return {object} The jquery object representing the
         * view element.
         */
        renderView: function () {
            var result;
            var data = this.model ? this.model.get() : {};
            dust.render(this.template, data, function (err, out) {
                result = out;
            });
            return result;
        }

    });

    /**
     * The Controller object. Responsible for handling views
     * based on the application state.
     */
    Sachet.Controller = Sachet.Observable.extend({

        /**
         * Constructor.
         */
        init: function () {
            this.isController = true;
            this.currentView = null;
            this.user = this.options.user;
        },

        /**
         * Renders the given view. Swaps the given view with
         * the current view if needed.
         * @param  {object} view The swappable view to be shown.
         * @return {object} The jquery object representing the
         * view's element.
         */
        renderView: function (view) {
            if (this.currentView) {
                this.currentView.hide();
            }
            view.render();
            this.currentView = view;
            return $(view.el);
        }
    });

}).call(this);