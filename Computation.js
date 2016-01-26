
var Meteor = require('meteor-client');

var isNodeEnv = require('is-node-env');
var isDev = !isNodeEnv && __DEV__;

if (!isNodeEnv) { // isDev) {
  var parseErrorStack = require('parseErrorStack');
  var ExceptionsManager = require('ExceptionsManager');
}

var Tracker = require('./Tracker');

var nextId = 1;

//
// http://docs.meteor.com/#tracker_computation

/**
 * @summary A Computation object represents code that is repeatedly rerun
 * in response to
 * reactive data changes. Computations don't have return values; they just
 * perform actions, such as rerendering a template on the screen. Computations
 * are created using Tracker.autorun. Use stop to prevent further rerunning of a
 * computation.
 * @instancename computation
 */
Tracker.Computation = function (f, parent, onError) {

  var self = this;

  // http://docs.meteor.com/#computation_stopped

  /**
   * @summary True if this computation has been stopped.
   * @locus Client
   * @memberOf Tracker.Computation
   * @instance
   * @name  stopped
   */
  self.stopped = false;

  // http://docs.meteor.com/#computation_invalidated

  /**
   * @summary True if this computation has been invalidated (and not yet rerun), or if it has been stopped.
   * @locus Client
   * @memberOf Tracker.Computation
   * @instance
   * @name  invalidated
   * @type {Boolean}
   */
  self.invalidated = false;

  // http://docs.meteor.com/#computation_firstrun

  /**
   * @summary True during the initial run of the computation at the time `Tracker.autorun` is called, and false on subsequent reruns and at other times.
   * @locus Client
   * @memberOf Tracker.Computation
   * @instance
   * @name  firstRun
   * @type {Boolean}
   */
  self.firstRun = true;

  self._id = nextId++;
  self._onInvalidateCallbacks = [];
  self._onStopCallbacks = [];
  // the plan is at some point to use the parent relation
  // to constrain the order that computations are processed
  self._parent = parent;
  self._func = f;
  self._onError = onError;
  self._sync = false;
  self._recomputing = false;

  // Register the computation within the global Tracker.
  Tracker._computations[self._id] = self;

  try {
    self._compute();
  } catch (e) {
    self._reportException(e);
    self.stop();
  }

  self.firstRun = false;
};

// http://docs.meteor.com/#computation_oninvalidate

/**
 * @summary Registers `callback` to run when this computation is next invalidated, or runs it immediately if the computation is already invalidated.  The callback is run exactly once and not upon future invalidations unless `onInvalidate` is called again after the computation becomes valid again.
 * @locus Client
 * @param {Function} callback Function to be called on invalidation. Receives one argument, the computation that was invalidated.
 */
Tracker.Computation.prototype.onInvalidate = function (f) {
  var self = this;

  if (typeof f !== 'function')
    throw new Error("onInvalidate requires a function");

  if (self.invalidated) {
    Tracker.nonreactive(function () {
      f(self);
    });
  } else {
    self._onInvalidateCallbacks.push(f);
  }
};

/**
 * @summary Registers `callback` to run when this computation is stopped, or runs it immediately if the computation is already stopped.  The callback is run after any `onInvalidate` callbacks.
 * @locus Client
 * @param {Function} callback Function to be called on stop. Receives one argument, the computation that was stopped.
 */
Tracker.Computation.prototype.onStop = function (f) {
  var self = this;

  if (typeof f !== 'function')
    throw new Error("onStop requires a function");

  if (self.stopped) {
    Tracker.nonreactive(function () {
      f(self);
    });
  } else {
    self._onStopCallbacks.push(f);
  }
};

// http://docs.meteor.com/#computation_invalidate

/**
 * @summary Invalidates this computation so that it will be rerun.
 * @locus Client
 */
Tracker.Computation.prototype.invalidate = function () {
  var self = this;
  if (self.invalidated) {
    return;
  }
  self.invalidated = true;

  // if (isDev) {
  self.stack = parseErrorStack(Error());
  // }

  // if we're currently in _recompute(), don't enqueue
  // ourselves, since we'll rerun immediately anyway.
  var willRecompute = ! self._recomputing && ! self.stopped;
  if (! self._sync && willRecompute) {
    Tracker._requireFlush();
    Tracker._pendingComputations.push(this);
  }

  // callbacks can't add callbacks, because
  // self.invalidated === true.
  for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++) {
    Tracker.nonreactive(function () {
      f(self);
    });
  }
  self._onInvalidateCallbacks = [];

  // Synchronous computations recompute immediately.
  if (self._sync && willRecompute) {
    self._recompute();
  }
};

// http://docs.meteor.com/#computation_stop

/**
 * @summary Prevents this computation from rerunning.
 * @locus Client
 */
Tracker.Computation.prototype.stop = function () {
  var self = this;

  if (! self.stopped) {
    self.stopped = true;
    self.invalidate();
    // Unregister from global Tracker.
    delete Tracker._computations[self._id];
    for(var i = 0, f; f = self._onStopCallbacks[i]; i++) {
      Tracker.nonreactive(function () {
        f(self);
      });
    }
    self._onStopCallbacks = [];
  }
};

Tracker.Computation.prototype._compute = function () {
  var self = this;
  self.invalidated = false;

  var previous = Tracker.currentComputation;
  Tracker._setCurrentComputation(self);
  var previousInCompute = Tracker._inCompute;
  Tracker._inCompute = true;
  try {
    self._func(self);
  } finally {
    Tracker._setCurrentComputation(previous);
    Tracker._inCompute = previousInCompute;
  }
};

Tracker.Computation.prototype._needsRecompute = function () {
  var self = this;
  return self.invalidated && ! self.stopped;
};

Tracker.Computation.prototype._recompute = function () {
  var self = this;

  self._recomputing = true;
  try {
    if (self._needsRecompute()) {
      try {
        self._compute();
      } catch (e) {
        self._reportException(e);
      }
    }
  } finally {
    self._recomputing = false;
  }
};

Tracker.Computation.prototype._reportException = function (e) {
  if (isDev) {
    e.computation = this;
  }
  if (this._onError) {
    this._onError(e);
  } else {
    Meteor._debug(e);
  }
};
