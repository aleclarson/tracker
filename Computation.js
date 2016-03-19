
var throwFailure = require('failure').throwFailure;
var isDev = require('isDev');

var Tracker = require('./Tracker');

var nextId = 1;

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
Tracker.Computation = function (config) {

  var self = this;

  // http://docs.meteor.com/#computation_stopped

  /**
   * @summary True if this computation has been stopped.
   * @locus Client
   * @memberOf Tracker.Computation
   * @instance
   * @name  stopped
   */
  self.stopped = true;

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
  self._recomputing = false;

  self.keyPath = config.keyPath;
  self._func = config.func;
  self._onError = config.onError;
  self._sync = config.sync === true;
  self._DEBUG = config.DEBUG;

  self._onInvalidateCallbacks = [];
  self._onStopCallbacks = [];

  // the plan is at some point to use the parent relation
  // to constrain the order that computations are processed
  self._parent = config.parent || Tracker.currentComputation;

  // Register the computation within the global Tracker.
  Tracker._computations[self._id] = self;
};

Tracker.Computation.prototype.start = function () {
  var self = this;

  if (! self.stopped) {
    return;
  }
  self.stopped = false;

  try {
    self._compute();
  } catch (e) {
    self._throwFailure(e);
    self.stop();
  }

  self.firstRun = false;

  if (Tracker.active) {
    Tracker.onInvalidate(function () {
      self.stop();
    });
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
  if (self._DEBUG) {
    console.log('Invalidated: ' + self.getDisplayName());
  }

  if (self._sync) {
    if (! self.stopped) {
      self._onInvalidate();
      self._recompute();
    }
    return;
  }

  if (isDev) {
    self._invalidatedError = [
      '::  When the Computation was invalidated  ::',
      Error()
    ];
  }

  // if we're currently in _recompute(), don't enqueue
  // ourselves, since we'll rerun immediately anyway.
  if (! self._recomputing && ! self.stopped) {
    Tracker._requireFlush();
    Tracker._pendingComputations.push(this);
  }

  self._onInvalidate();
};

Tracker.Computation.prototype._onInvalidate = function () {
  var self = this;

  // callbacks can't add callbacks, because
  // self.invalidated === true.
  for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++) {
    Tracker.nonreactive(function () {
      f(self);
    });
  }

  self._onInvalidateCallbacks = [];
};

// http://docs.meteor.com/#computation_stop

/**
 * @summary Prevents this computation from rerunning.
 * @locus Client
 */
Tracker.Computation.prototype.stop = function () {
  var self = this;

  if (self.stopped) {
    return;
  }

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

Tracker.Computation.prototype.getDisplayName = function () {
  var self = this;

  var displayName = '' + self._id;
  if (self.keyPath) {
    displayName += '.' + self.keyPath;
  }

  return displayName;
};

Tracker.Computation.prototype._compute = function () {
  var self = this;
  self.invalidated = false;

  var previous = Tracker.currentComputation;
  Tracker._setCurrentComputation(self);
  var previousInCompute = Tracker._inCompute;
  Tracker._inCompute = true;
  try {
    if (self._DEBUG) {
      console.log('Computing:   ' + self.getDisplayName());
    }
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
        self._throwFailure(e);
      }
    }
  } finally {
    self._recomputing = false;
  }
};

Tracker.Computation.prototype._throwFailure = function (error) {
  var errorData = {};
  if (isDev) {
    errorData.stack = this._invalidatedError;
  }

  if (this._onError) {
    this._onError(error, errorData);
  } else {
    throwFailure(error, errorData);
  }
};
