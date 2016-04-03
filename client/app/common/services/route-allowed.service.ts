module supedidos.common {

	import AC = supedidos.common;

	interface ICheckFn {
		() : ng.IPromise<boolean>;
	}

	export interface IZero {
		() : void
	};

	export interface IPromiseHandler {
		(boolean) : void
	};

	export class RouteAllowedService {

		static $inject = ['$q', '$state', 'Auth'];

		constructor(private $q : ng.IQService, private $state, private Auth) {

		}

		onTrue(cb:Function) : IPromiseHandler {
            return (state : Boolean) => {
                if (state) {
					return cb();
                }
            }
		}

		onFalse(cb:Function) : IPromiseHandler {
            return (state : Boolean) => {
                if (!state) {
					return cb();
                }
            }
		}

		redirect(route : String, params? : Object) : IZero {
            return () => {
                this.$state.go(route, params, {reload: true});
            }
		}

		reload() : IZero {
            return () => {
                this.$state.go(this.$state.next.name, this.$state.next.params, {reload: true});
            }
		}

		falsyToBool(psConstructor:AC.IPromiseConstructor) : AC.IPromiseConstructor {
			return () => {
				return psConstructor().then((res) => {
					return res ? true : false;
				});
			}
		}

		truthyToBool(psConstructor:AC.IPromiseConstructor) : AC.IPromiseConstructor {
			return () => {
				return psConstructor().then((res) => {
					return res ? false : true;
				});
			}
		}

		errorToBool(psConstructor:AC.IPromiseConstructor) : AC.IPromiseConstructor {
			return () => {
				return this.$q((resolve, reject) => {
					return psConstructor().then(
						_.partial(resolve, true),
						_.partial(resolve, false)
					);
				});
			}
		}

		private checkPromiseState(args:AC.IPromiseConstructor[], index:number, onStep:Function, onFinish:Function) {
			if (!args[index]) {
				return onFinish();
			}

			args[index]().then((state) => {
				onStep(state, () => {
					this.checkPromiseState(args, index + 1, onStep, onFinish);
				});
			});
        }

		orSeries(...args:AC.IPromiseConstructor[]) : AC.IPromiseConstructor {
			return () => {
				return this.$q((resolve, reject) => {
					this.checkPromiseState(args, 0, (state, next) => {
						if (state) {
							resolve(true);
						} else {
							next();
						}
					}, () => {
						resolve(false);
					});
				});
			}
		}

		andSeries(...args:AC.IPromiseConstructor[]) : AC.IPromiseConstructor {
			return () => {
				return this.$q((resolve, reject) => {
					this.checkPromiseState(args, 0, (state, next) => {
						if (!state) {
							resolve(false);
						} else {
							next();
						}
					}, () => {
						resolve(true);
					});
				});
			}
		}

		or(...args:AC.IPromiseConstructor[]) : AC.IPromiseConstructor {
			return () => {
				return this.$q.all(args.map(fn => fn())).then(results => {
					return results.reduce((acc, curr) => {
						return acc || curr;
					}, false);
				});
			}
		}

		and(...args:AC.IPromiseConstructor[]) : AC.IPromiseConstructor {
			return () => {
				return this.$q.all(args.map(fn => fn())).then(results => {
					return results.reduce((acc, curr) => {
						return acc && curr;
					}, true);
				});
			}
		}

		/**
	     * Promise compose for routes
	     */
	    handlerCompose(...args:IPromiseHandler[]) : IPromiseHandler {
	        return state => {
	            args.forEach(handler => {
					handler(state);
				});
	        };
		}

		/**
		 * Check if user is logged in, if not, throw login dialog
		 * if the login dialog needs to be throwed, the page needs to be reloaded
		 */
		ensureLogin() : ng.IPromise<{}> {
			// Check if user is logged in
			return this.Auth.isLogged().then(
				// If not, throw login dialog and then reload
				this.onFalse(() => {
					return this.Auth.makeLogin().then(
						this.reload(),
						this.$q.reject
					)
				})
			);
		}

		/**
	     * Compose functions to create a controller function for a state
	     */
	    composeCtrl(...composablesFns) {
	        var injection = _.union.apply(_, composablesFns.map(fn => fn.$inject));

	        composedController.$inject = injection;
	        function composedController(...args) {
	            var ctrl = this;
	            composablesFns.forEach(composableFn => {
	                var fnInjection = composableFn.$inject.map((module) => {
	                    return args[injection.indexOf(module)];
	                });
	                composableFn.apply(ctrl, fnInjection);
	            });
	        };
	        return composedController;
	    }

	    /**
	     * Create a function that injects the angular keys passed in the obj of the parameters
	     * and expose the keys in the scope named as the value
	     */
	    passCtrlData(modules : IInjectionObject) {
	        var injection = _.union(['$scope'], _.keys(modules));
	        ctrl.$inject = injection;
	        function ctrl(...args) {
	            var $scope = args[0];
	            _.slice(injection, 1).map((module, index) => {
	                $scope[modules[module]] = args[index + 1];
	            });
	        }
	        return ctrl;
	    }

	}

	angular
		.module('supedidos.common')
		.service('RouteAllowed', RouteAllowedService);

}
