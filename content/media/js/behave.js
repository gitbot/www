/*global $:true*/
(function () {
    "use strict";
    var root = this;

    var Behavior = root.Behavior = function (name, $container, events, data) {
        this.name = name;
        this.$container = $container.first();
        this.events = events;
        var behavior = this;
        $.each(data, function (key, value) {
            if (key !== 'name' && key !== '$container' && key !== 'events') {
                behavior[key] = value;
            }
        });
    };

    Behavior.transformHelper = function (defaults, options) {
        var transformed = $.extend({}, {triggers: []}, defaults);

        if (typeof(options) === "string" || options.jquery) {
            transformed.triggers.push({target: options});
        } else if ($.isArray(options)) {
            transformed.triggers = options;
        } else {
            transformed = options;
        }
        transformed.triggers = transformed.triggers || [];
        return transformed;
    };

    Behavior.prototype.walkEffects = function (visitor) {
        var behavior = this;
        $.each(this.events, function (trigger, effects) {
            var result = true;
            $.each(effects, function (i, effect) {
                result = visitor.call(behavior, effect, trigger);
                return result;
            });
            return result;
        });
    };

    Behavior.prototype.findEffectForTarget = function (target) {
        var result = null;
        $.each(this.events, function (trigger, effects) {
            var cont = true;
            $.each(effects, function (i, effect) {
                if (!target || effect.target === target) {
                    result = effect;
                    cont = false;
                }
                return cont;
            });
            return cont;
        });
        return result;
    };

    Behavior.prototype.fqeventName = function (namespace) {
        namespace = namespace || '';
        if ($.trim(namespace) !== '') {
            namespace = '.' + namespace;
        }
        return this.eventName + namespace;
    };

    Behavior.prototype.on = function (namespace, fn) {
        var behavior = this;
        if ($.isFunction(namespace)) {
            fn = namespace;
            namespace = undefined;
        }
        var eventName = this.fqeventName(namespace);
        this.$container.on(eventName, function () {
            fn.apply(behavior, arguments);
        });
        return this;
    };

    Behavior.prototype.off = function (namespace) {
        var eventName = this.fqeventName(namespace);
        this.$container.off(eventName);
        return this;
    };

    Behavior.getBehavior = function (name, $container) {
        if (!$container || !$container.length) return null;
        if (!name) return null;
        var behaviors = $container.data("behaviors") || {};
        return behaviors[name];
    };

    Behavior.setBehavior = function (name, $container, behavior) {
        if (!$container || !$container.length) return null;
        if (!name) return null;
        var behaviors = $container.data("behaviors") || {};
        behaviors[name] = behavior;
        $container.data("behaviors", behaviors);
        return true;
    };

    Behavior.mapTriggers = function (options, triggers) {
        var eventMap = {};
        var defaultTrigger = {
            event: 'click',
            target: null,
            tag: null,
            parentTag: null
        };

        triggers = $.map(triggers || [], function (trigger) {
            return $.extend({}, defaultTrigger, options.instanceDefaults, trigger);
        });

        $.each(triggers, function (i, trigger) {
            var effects = eventMap[trigger.event] || [];
            effects.push(trigger);
            eventMap[trigger.event] = effects;
        });
        return eventMap;
    };

    Behavior.prototype.get = function (name) {
        return Behavior.getBehavior(name, this.$container);
    };

    Behavior.prototype.trigger = function (namespace, data) {
        if (!this.eventName) {
            return;
        }
        if (typeof(namespace) !== "string") {
            data = namespace;
            namespace = undefined;
        }
        this.$container.trigger(this.fqeventName(namespace), data);
    };

    Behavior.prototype.clear = function () {
        var behavior = this;
        $.each(this.events || [], function (trigger, effects) {
            $.each(effects, function (i, effect) {
                if (effect.parentTag) {
                    behavior.$container.removeClass(effect.parentTag);
                }
                if (effect.tag) {
                    var target = effect.target.jquery ? effect.target: $(effect.target, behavior.$container);
                    $(target).removeClass(effect.tag);
                }
            });
        });
        if (this.eventName) {
            this.trigger('clear');
        }
    };

    Behavior.prototype.destroy = function () {
        var behavior = this;
        $.each(this.triggers || [], function (trigger, effects) {
            $.each(effects, function (i, effect) {
                behavior.$container.off(effect.event);
            });
        });
        Behavior.setBehavior(this.name, this.$container, null);
        this.off();
        if (this.eventName) {
            this.trigger('destroy');
        }
    };

    Behavior.prototype.init = function () {
        var behavior = this;
        $.each(this.events, function (event, effects) {
            $.each(effects, function (i, effect) {
                var onEffect = function (e) {
                    var result = false;
                    if (!effect.doNotTag) {
                        if (effect.parentTag) {
                            behavior.$container.addClass(effect.parentTag);
                        }
                        if (effect.tag) {
                            var $target = $(e.target).closest(effect.target);
                            if ($target.hasClass(effect.tag)) return false;
                            $(effect.target, behavior.$container).removeClass(effect.tag);
                            $target.addClass(effect.tag);
                        }
                    }
                    if (effect.fn) {
                        result = effect.fn.call(behavior, {
                            target: $(e.target),
                            behavior: behavior,
                            effect: effect,
                            event: e
                        });
                    }
                    behavior.trigger({
                        target: $(e.target),
                        behavior: behavior,
                        effect: effect,
                        event: e
                    });
                    return result;
                };
                if (effect.target && effect.target.jquery) {
                    effect.target.on(event, onEffect);
                } else {
                    behavior.$container.on(event, effect.target, onEffect);
                }
            });
        });
    };

    Behavior.add = function (name, processors) {
        $.fn[name] = function (options) {
            options = options || {};
            var noop = function () {};

            $.each(this, function (i, root) {
                var $container = $(root);
                var behavior = null;
                processors = processors || {};
                if (options.clear || options.destroy) {
                    behavior = Behavior.getBehavior(name, $container);

                    if (behavior) {
                        behavior[options.clear ? "clear":"destroy"]();
                    }
                    return this;
                }
                var transform = $.isFunction(processors) ? processors :
                                        (processors.transform ? processors.transform : noop);
                var init = processors.init || noop;
                options = options || {};
                options = transform.call($container, name, options) || options;
                var triggers = Behavior.mapTriggers(options, options.triggers || []);
                behavior = new Behavior(name, $container, triggers, options);
                init.call(behavior);
                Behavior.setBehavior(name, $container, behavior);
                behavior.init();
                return true;
            });
            return this;
        };
    };

    Behavior.add('navigable',  {
        transform: function transform(name, options) {
            var triggers = [{
                event: 'keydown',
                fn: function handleKeyDown(data) {
                    var event = data.event;
                    var keycode = (event.keyCode ? event.keyCode:
                               (event.which ? event.which: event.charCode));
                    var backcall = function (name) {
                        if ($.isFunction(options[name])) {
                            event.stopPropagation();
                            options[name].call(data.behavior, {event: event});
                            return false;
                        }
                        return true;
                    };
                    var keyMap = {
                        "13": "enter",
                        "36": "first",
                        "37": "left",
                        "38": "up",
                        "39": "right",
                        "40": "down",
                        "35": "last",
                        "33": "pageup",
                        "34": "pagedown",
                        "27": "cancel"
                    };
                    if (keyMap[keycode]) {
                        return backcall(keyMap[keycode]);
                    }
                    return true;
                }
            }];
            options = options || {};
            options.triggers = triggers;
            return options;
        },
        init: function initializer() {

            this.focus = function () {
                this.$container.attr("tabindex", "0");
                this.$container.focus();
            };

            this.removeFocus = function () {
                this.$container.removeAttr("tabindex");
                this.$container.blur();
            };
        }
    });

    Behavior.add('selectable', {

        transform: function transformer(name, options) {
            var transformed = {
                eventName: name,
                instanceDefaults: {
                    tag: 'selected',
                    parentTag: 'hasSelection'
                }
            };
            return Behavior.transformHelper(transformed, options);
        },

        init: function initializer() {

            this.selectFirst = function (target) {
                var effect = this.findEffectForTarget(target);
                if (effect) {
                    this.$container.find(effect.target).first().click();
                }
            };

            this.selectPrevious = function (target) {
                var effect = this.findEffectForTarget(target);
                if (effect) {
                    var $selected = this.$container.find(effect.target + '.selected');
                    if (!$selected.length) {
                        this.selectFirst(target);
                    } else {
                        $selected.prev(effect.target).click();
                    }
                }
            };

            this.selectNext = function (target) {
                var effect = this.findEffectForTarget(target);
                if (effect) {
                    var $selected = this.$container.find(effect.target + '.selected');
                    if (!$selected.length) {
                        this.selectFirst(target);
                    } else {
                        $selected.next(effect.target).click();
                    }
                }
            };

            this.selectLast = function (target) {
                var effect = this.findEffectForTarget(target);
                if (effect) {
                    this.$container.find(effect.target).last().click();
                }
            };

            this.on(function (event, data) {
                var $container = data.behavior.$container;
                var behavior = data.behavior;
                var effect = data.effect;
                behavior.selected = $container.find(effect.target + '.selected');
                behavior.previous = $(behavior.selected).prev(effect.target);
                behavior.next = $(behavior.selected).next(effect.target);
                behavior.first = $container.find(effect.target).first();
                behavior.last = $container.find(effect.target).last();
            });
        }
    });

    Behavior.add('hoverable', function transform(name, options) {
        var triggers = [
            {
                event: 'mouseenter',
                parentTag: 'hover'
            },
            {
                event: 'mouseleave',
                fn: function () {
                    this.clear();
                }
            }
        ];
        options = options || {};
        options.eventName = name;
        options.triggers = triggers;
        return options;
    });

    Behavior.toggleableTransform =  function transformer(name, options) {
        var defaults = {
            target: null,
            tag: 'is-active',
            parentTag: 'is-active',
            doNotTag: true
        };
        if (typeof(options) === 'string') {
            options = {target: options};
        }
        options = $.extend({}, defaults, options);
        var transformed = {
            eventName: name,
            triggers: [$.extend({}, defaults, options, {
                fn: function (data) {
                    this.$container.toggleClass(options.parentTag);
                    var $target = $(data.target).closest(data.effect.target);
                    $target.toggleClass(options.tag);
                    data.event.preventDefault();
                    return data.behavior.$container.closest($target).length === 0;
                }
            })]
        };
        return transformed;
    };

    Behavior.add('toggleable', {
        transform: function transformer(name, options) {
            return Behavior.toggleableTransform(name, options);
        }
    });

    Behavior.add('menuToggleable', {
        transform: function transformer(name, options) {
            var transformed = Behavior.toggleableTransform(name, options);
            transformed.triggers.push({
                target: $('html'),
                fn: function (data) {
                    if (data.behavior.$container.hasClass('is-active')) {
                        if (($(data.target).closest(data.behavior.$container).length > 0)) {
                            return true;
                        } else {
                            data.behavior.clear();
                            return false;
                        }
                    } else {
                        return true;
                    }
                }
            });
            if (!options.mouseCanLeave) {
                transformed.triggers.push({
                    event: 'mouseleave',
                    fn: function () {
                        this.clear();
                    }
                });
            }
            transformed.triggers.push({
                target: this,
                fn: function (data) {
                    if (data.event.target !== data.event.currentTarget) {
                        data.event.stopPropagation();
                        return true;
                    }
                    data.event.preventDefault();
                    return true;
                }
            });
            return transformed;
        }
    });

    Behavior.add('overlayable', {
        transform: function transformer(name, options) {
            var transformed = {
                eventName: name,
                instanceDefaults: {
                    tag: 'is-active',
                    parentTag: 'is-active'
                }
            };
            transformed = Behavior.transformHelper(transformed, options);
            var closeTrigger = {
                event: 'click',
                target: '.cancel',
                fn: function onClose() {
                    this.clear();
                    return false;
                }
            };
            transformed.triggers.push(closeTrigger);
            return transformed;
        },
        init: function initializer() {
            this.on(function (event, data) {
                if (data.effect.target !== '.cancel') {
                    $("body").addClass("hasOverlay");
                }
            });

            this.clear = function () {
                Behavior.prototype.clear.call(this);
                $("body").removeClass("hasOverlay");
            };
        }
    });
}).call(this);