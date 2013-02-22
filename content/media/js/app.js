/*global Sachet: true, Behavior:true, page:true, io:true */
;(function () {
    "use strict";
    var root = this;
    var Apt = root.Apt = root.Apt || {};

    Apt.store = Sachet.store = new Sachet.Keystore({}, 'local');

    Apt.GithubPathField = Sachet.Field.extend({
        fullUrl: function () {
            return 'https://github.com/' + this.get();
        }
    });

    Apt.RepoField = Apt.GithubPathField.extend({
        gitUrl: function (publicUrl) {
            var base = publicUrl ? 'git://github.com/' : 'git@github.com:';
            return base + this.get() + '.git';
        }
    });

    Apt.ReposField = Sachet.ListField.spec({fieldType: Apt.RepoField});


    /**
     * The user model
     * @type {object}
     */
    Apt.User = Sachet.Model.spec({
        id: {},
        name: {},
        description: {},
        avatar_url: {},
        login: {},
        synced: {defaultValue: false},
        repos: new Apt.ReposField(),
        projects: new Apt.ReposField()
    });

    /**
     * The user model
     * @type {object}
     */
    Apt.Login = Sachet.Model.spec({
        url: {},
        state: {}
    });

    Apt.ProtectedService = Sachet.Service.extend({
        /**
         * Calls the remote API. Adds the auth header if available.
         * @param  {object} options Overrides for the service call options.
         * @return {Promise}
         */
        rpc: function (options) {
            var authcode = this.store().get('authcode');
            if (!authcode) {
                return $.Deferred().reject({
                    error: true,
                    message: "Access denied."
                });
            }
            options = $.extend({}, {headers: {}}, options);
            options.headers['x-auth-authcode'] = authcode;
            return Sachet.Service.prototype.rpc.call(this, options);
        }
    });

    Apt.ProtectedResource = Sachet.Resource.extend({
        init: function (baseurl, collectionName) {
            Sachet.Resource.prototype.init.call(this, baseurl, collectionName);
            this.service = new Apt.ProtectedService(baseurl, collectionName);
        }
    });


    /**
     * The auth url service.
     * @type {object}
     */
    Apt.AuthUrl = Sachet.Service.make({
        baseurl: '{{ site.config.api }}',
        path: 'auth/github',
        model: Apt.Login
    });

    /**
     * The authentication service.
     * @type {object}
     */
    Apt.Authenticate = Sachet.Service.extend({

        /**
         * Setup the API baseurl and path.
         */
        init: function () {
            Sachet.Service.prototype.init.call(this,
                '{{ site.config.api }}',
                'auth/github/user');
        },

        /**
         * Lookup data for calling the user profile API.
         */
        lookupData: function () {
            var store = this.store();
            var data = {
                code: store.get('github_code'),
                state: store.get('github_state')
            };

            if (!(data.code && data.state)) {
                delete data.code;
                delete data.state;
            }

            this.data = data;
        },

        /**
         * Calls the remote API call.
         * @param  {object} options Overrides for the service call options.
         * @return {Promise}
         */
        rpc: function (options) {
            this.lookupData();
            options = options || {};
            var data = $.extend({}, this.data, options.data);
            if (!(data.code && data.state)) {
                return $.Deferred().reject({
                    error: true,
                    message: "Not enough parameters provided to get the user profile."
                }).promise();
            }
            options.data = data;
            return Sachet.Service.prototype.rpc.call(this, options);
        }

    });

    /**
     * The logout service.
     * @type {object}
     */
    Apt.Logout = Apt.ProtectedService.make({
        baseurl: '{{ site.config.api }}',
        path: 'auth/github/logout'
    });

     /**
     * The profile service.
     * @type {object}
     */
    Apt.Profile = Apt.ProtectedService.make({
        baseurl: '{{ site.config.api }}',
        path: 'auth/github/profile',
        model: Apt.User
    });

    /**
     * The repos service.
     * @type {object}
     */
    Apt.Repos = Apt.ProtectedService.make({
        baseurl: '{{ site.config.api }}',
        path: 'user/repos'
    });

    Apt.Projects = Apt.ProtectedResource.make({
        baseurl: '{{ site.config.api }}',
        collectionName: 'user/projects'
    });

    Apt.HeaderView = Sachet.View.extend({
        el: "#header #nav",
        template: 'account',

        events: {
            "click #logout": "logout"
        },

        logout: function () {
            Apt.app.navigate('logout');
        }

    });

    Apt.HomeView = Sachet.SwappableView.extend({

        el: "#homeContainer",

        template: 'home',

        render: function () {
            var     result = Sachet.SwappableView.prototype.render.apply(this, arguments)
                ,   view = this;
            this.$('.projectActions').menuToggleable(
                { target: $("#newProject"), mouseCanLeave: true})
                .on('menuToggleable', function () {
                    $(this).find('input').focus();
                });
            this.checkReady();
            this.model.on('synced', function() {
                view.checkReady();
            });
            return result;
        },

        checkReady: function() {
            this.$el.toggleClass('ready', this.model.fields.synced.get() === true);

        },

        projectError: function ()  {
            /*jshint devel:true */
            console.log("Cannot add project");
        },

        projectSelected: function ()  {
            Behavior.getBehavior('menuToggleable', this.$('.projectActions')).clear();
        },

        dispose: function () {
            this.model.off('synced');
            Sachet.View.prototype.dispose.call(this, arguments);
            Behavior.getBehavior('menuToggleable', this.$('.projectActions')).destroy();
        }
    });

    Apt.LoginView = Sachet.SwappableView.extend({

        el: "#loginContainer",

        template: 'login'
    });

    Apt.AddProjectView = Sachet.View.extend({

        el: "#newProjectContainer",

        template: 'repos',

        events: {
            "keyup #repoFilter": "filterRepos",
            "change #repoFilter": "filterRepos",
            "click .repo": "repoSelected"
        },

        elementForView: function () {
            return this.$("#repoSelector");
        },

        dataForView: function () {
            var     result
                ,   projects = this.model.fields.projects.get()
                ,   unfiltered = this.model.fields.repos.get()
                ,   filter = $.trim($("#repoFilter").val())
                ,   repos = [];

            $.each(unfiltered, function (i, repo) {
                if ($.inArray(repo, projects) < 0) {
                    repos.push(repo);
                }
            });

            var rankers = [
                function ownerRepo(repo) {
                    var or = filter.split('/');
                    if (or.length === 2) {
                        return new RegExp(or[0] + '.*/' + or[1] + '.*').test(repo);
                    }
                    return false;
                },
                function repoStart(repo) {
                    return repo.indexOf('/' + filter) === repo.lastIndexOf('/');
                },
                function repoContains(repo) {
                    return new RegExp('.*/.*' + filter + '.*').test(repo);
                },
                function contains(repo) {
                    return repo.indexOf(filter) === 0;
                },
                function someMatch(repo) {
                    return new RegExp(filter.split('').join('.*')).test(repo);
                }
            ];

            if (filter.length === 0) {
                result = repos;
            } else {
                result = Sachet.rankAndSort(repos, rankers, function sorter(repo1, repo2) {
                    var     or1 = repo1.split('/')
                        ,   or2 = repo2.split('/');

                    return (or1[1].toLowerCase() === or2[1].toLowerCase()) ?
                                or1[0].toLowerCase() > or2[0].toLowerCase() :
                                or1[1].toLowerCase() > or2[1].toLowerCase();
                });
            }
            return {repos: result};
        },

        filterRepos: function () {
            this.render();
            return false;
        },

        repoSelected: function (event) {
            Apt.app.addProject($(event.target).data("path"));
            return false;
        }

    });

    Apt.ProjectListView = Sachet.View.extend({
        el: '#projectList',
        template: 'projects',

        events: {
            "click .sync": "syncProject",
            "click .del": "deleteProject"
        },

        syncProject: function (event) {
            Apt.app.syncProject($(event.target).parents("li").children(".repo").text());
        },

        deleteProject: function (event) {
            Apt.app.deleteProject($(event.target).parents("li").children(".repo").text());
        }
    });

    Apt.MainController = Sachet.Controller.extend({

        /**
         * Constructor.
         */
        init: function () {
            Sachet.Controller.prototype.init.apply(this, arguments);
            page('/', this.load.bind(this));
            this.route('', this.load);
            this.route('home');
            this.route('login');
            this.route('logout');
            page();
        },

        route: function (path, fn) {
            if (!fn) {
                fn = this[path];
            }
            page('#' + path, this.header.bind(this), fn.bind(this));
            return this;
        },

        header: function (ctx, next) {
            if (this.headerView) {
                this.headerView.dispose();
            }
            this.headerView = new Apt.HeaderView({model: this.user});
            this.headerView.render();
            if ($.isFunction(next)) {
                next();
            }
        },

        navigate: function (path, data) {
            if (this.socket) {
                this.socket.disconnect();
            }
            page('#' + path, data);
        },

        load: function () {
            var controller = this;
            var store = this.store();

            // We know the user, take him home
            if (this.user) this.navigate('home');

            // Persist parameters
            var data = {};
            $.each(['code', 'state'], function (i, key) {
                var val = controller.params[key];
                if (val) {
                    data[key] = val;
                    store.set('github_' + key, val);
                }
            });

            if (data.code && data.state) {
                // Authentication required.
                //
                //
                // Call the user Authentication API
                // If it fails, go back to the login page.
                var auth = new Apt.Authenticate();
                auth.rpc().done(function () {
                    store.set('authcode', data.code);
                    window.location = '/';
                }).fail(function () {
                    controller.navigate('login');
                }).always(function () {
                    store.remove('github_authurl');
                    store.remove('github_code');
                    store.remove('github_state');
                });
            } else {
                controller.navigate('home');
            }
        },

        addProject: function (repo) {
            var controller = this;
            var projects = new Apt.Projects();
            this.homeView.projectSelected();
            projects.put({
                resourceName: encodeURIComponent(repo)
            }).done(function () {
                controller.user.fields.projects.add(repo);
                controller.refreshProjects();
            }).fail(function () {
                controller.homeView.projectError();
            });
        },

        syncProject: function (repo) {
            var controller = this;
            var projects = new Apt.Projects();

            projects.patch({
                resourceName: encodeURIComponent(repo)
            }).done(function () {
                controller.refreshProjects();
            }).fail(function () {
                controller.homeView.projectError();
            });
        },

        deleteProject: function (repo) {
            var controller = this;
            var projects = new Apt.Projects();

            projects.del({
                resourceName: encodeURIComponent(repo)
            }).done(function () {
                controller.user.fields.projects.remove(repo);
                controller.refreshProjects();
            }).fail(function () {
                controller.homeView.projectError();
            });
        },

        refreshProjects: function (skipRepos) {
            this.projectListView.render();
            if (!skipRepos) {
                this.refreshRepos();
            }
        },

        refreshRepos: function () {
            this.addProjectView.render();
        },

        home: function () {
            var controller = this;

            var render = function () {

                if (!controller.homeView) {
                    controller.homeView = new Apt.HomeView({model: controller.user});
                }
                controller.renderView(controller.homeView);

                if (!controller.addProjectView) {
                    controller.addProjectView = new Apt.AddProjectView({model: controller.user});
                }
                controller.refreshRepos();

                if (!controller.projectListView) {
                    controller.projectListView = new Apt.ProjectListView({model: controller.user});
                    controller.projectListView.delegateEvents();
                }

                if (controller.socket) {
                    controller.socket.disconnect();
                }
                var socket = controller.socket = io.connect("{{ site.config.api }}");
                var refreshProjects = function() {
                    var repos = new Apt.Repos(),
                        projects = new Apt.Projects();
                    repos.rpc().done(function (data) {
                        controller.user.fields.repos.set(data);
                        controller.user.fields.synced.set(true);
                        controller.user.trigger('synced');
                        controller.refreshRepos();
                    });
                    projects.rpc().done(function(data) {
                        controller.user.fields.projects.set(data);
                        controller.refreshProjects(true);
                    });
                };
                socket.on("ready", function() {
                    refreshProjects();
                }).on("projectReady", function() {
                    refreshProjects(false);
                });
                socket.emit('init', controller.user.fields.login.get());
            };

            if (!controller.user) {
                var profile = new Apt.Profile();
                profile.rpc().done(function (user) {
                                        controller.user = user;
                    controller.header();
                    render();
                }).fail(function () {
                    controller.navigate('login');
                });
            } else {
                render();
            }
        },

        login: function () {
            var controller = this;
            var store = this.store();
            var auth = new Apt.AuthUrl();
            auth.rpc().done(function (obj) {
                store.set('github_authurl', obj.fields.url.get());
                store.set('github_state', obj.fields.state.get());
                if (controller.loginView) {
                    controller.loginView.remove();
                }
                controller.loginView = new Apt.LoginView({model: obj});
                controller.renderView(controller.loginView);
            }).fail(function (data) {
                controller.navigate('error', data);
            });
        },

        logout: function ()  {
            var controller = this;
            var store = this.store();
            var logout = new Apt.Logout();
            logout.rpc().done(function () {
                controller.user.clear();
                controller.user = null;
                store.remove('authcode');
                controller.navigate('login');
            });
        }
    });

}).call(this);