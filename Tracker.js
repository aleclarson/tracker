
var Meteor = require('meteor-client');

// Provided by React Native
var setImmediate = global.setImmediate || require('setImmediate');

/**
 * @namespace Tracker
 * @summary The namespace for Tracker-related methods.
 */
var Tracker = {};

// http://docs.meteor.com/#tracker_active

/**
 * @summary True if there is a current computation, meaning that dependencies on reactive data sources will be tracked and potentially cause the current computation to be rerun.
 * @locus Client
 * @type {Boolean}
 */
Tracker.active = false;

// http://docs.meteor.com/#tracker_currentcomputation

/**
 * @summary The current computation, or `null` if there isn't one.  The current computation is the [`Tracker.Computation`](#tracker_computation) object created by the innermost active call to `Tracker.autorun`, and it's the computation that gains dependencies when reactive data sources are accessed.
 * @locus Client
 * @type {Tracker.Computation}
 */
Tracker.currentComputation = null;

Tracker._setCurrentComputation = function (c) {
  Tracker.currentComputation = c;
  Tracker.active = !! c;
};

// References to all computations created within the Tracker by id.
// Keeping these references on an underscore property gives more control to
// tooling and packages extending Tracker without increasing the API surface.
// These can used to monkey-patch computations, their functions, use
// computation ids for tracking, etc.
Tracker._computations = {};

// computations whose callbacks we should call at flush time
Tracker._pendingComputations = [];

// `true` if a Tracker.flush is scheduled, or if we are in Tracker.flush now
Tracker._willFlush = false;

// `true` if we are in Tracker.flush now
Tracker._inFlush = false;

// `true` if we are computing a computation now, either first time
// or recompute.  This matches Tracker.active unless we are inside
// Tracker.nonreactive, which nullfies currentComputation even though
// an enclosing computation may still be running.
Tracker._inCompute = false;

var afterFlushCallbacks = [];

Tracker._requireFlush = function () {
  if (! Tracker._willFlush) {
    setImmediate(Tracker._runFlush);
    Tracker._willFlush = true;
  }
};

// http://docs.meteor.com/#tracker_flush

/**
 * @summary Process all reactive updates immediately and ensure that all invalidated computations are rerun.
 * @locus Client
 */
Tracker.flush = function (options) {
  Tracker._runFlush({ finishSynchronously: true });
};

// Run all pending computations and afterFlush callbacks.  If we were not called
// directly via Tracker.flush, this may return before they're all done to allow
// the event loop to run a little before continuing.
Tracker._runFlush = function (options) {
  // XXX What part of the comment below is still true? (We no longer
  // have Spark)
  //
  // Nested flush could plausibly happen if, say, a flush causes
  // DOM mutation, which causes a "blur" event, which runs an
  // app event handler that calls Tracker.flush.  At the moment
  // Spark blocks event handlers during DOM mutation anyway,
  // because the LiveRange tree isn't valid.  And we don't have
  // any useful notion of a nested flush.
  //
  // https://app.asana.com/0/159908330244/385138233856
  if (Tracker._inFlush)
    throw new Error("Can't call Tracker.flush while flushing");

  if (Tracker._inCompute)
    throw new Error("Can't flush inside Tracker.autorun");

  options = options || {};

  Tracker._inFlush = true;
  Tracker._willFlush = true;

  var recomputedCount = 0;
  var finishedTry = false;
  try {
    while (Tracker._pendingComputations.length ||
           afterFlushCallbacks.length) {

      // recompute all pending computations
      while (Tracker._pendingComputations.length) {
        var comp = Tracker._pendingComputations.shift();
        comp._recompute();
        if (comp._needsRecompute()) {
          Tracker._pendingComputations.unshift(comp);
        }

        if (! options.finishSynchronously && ++recomputedCount > 1000) {
          finishedTry = true;
          return;
        }
      }

      if (afterFlushCallbacks.length) {
        // call one afterFlush callback, which may
        // invalidate more computations
        var func = afterFlushCallbacks.shift();
        try {
          func();
        } catch (e) {
          Meteor._debug(e);
        }
      }
    }
    finishedTry = true;
  } finally {
    if (! finishedTry) {
      Tracker._inFlush = false; // needed before calling `Tracker.flush()` again
      // finish flushing
      Tracker._runFlush({
        finishSynchronously: options.finishSynchronously
      });
    }
    Tracker._willFlush = false;
    Tracker._inFlush = false;
    if (Tracker._pendingComputations.length || afterFlushCallbacks.length) {
      // We're yielding because we ran a bunch of computations and we aren't
      // required to finish synchronously, so we'd like to give the event loop a
      // chance. We should flush again soon.
      if (options.finishSynchronously) {
        throw new Error("still have more to do?");  // shouldn't happen
      }
      setTimeout(Tracker._requireFlush, 10);
    }
  }
};

// http://docs.meteor.com/#tracker_autorun
//
// Run f(). Record its dependencies. Rerun it whenever the
// dependencies change.
//
// Returns a new Computation, which is also passed to f.
//
// Links the computation to the current computation
// so that it is stopped if the current computation is invalidated.

/**
 * @callback Tracker.ComputationFunction
 * @param {Tracker.Computation}
 */
/**
 * @summary Run a function now and rerun it later whenever its dependencies
 * change. Returns a Computation object that can be used to stop or observe the
 * rerunning.
 * @locus Client
 * @param {Tracker.ComputationFunction} runFunc The function to run. It receives
 * one argument: the Computation object that will be returned.
 * @param {Object} [options]
 * @param {Function} options.onError Optional. The function to run when an error
 * happens in the Computation. The only argument it recieves is the Error
 * thrown. Defaults to the error being logged to the console.
 * @returns {Tracker.Computation}
 */
Tracker.autorun = function (f, options) {
  if (typeof f !== 'function')
    throw new Error('Tracker.autorun requires a function argument');

  options = options || {};

  constructingComputation = true;
  var c = new Tracker.Computation(
    f, Tracker.currentComputation, options.onError);

  if (Tracker.active)
    Tracker.onInvalidate(function () {
      c.stop();
    });

  return c;
};

// http://docs.meteor.com/#tracker_nonreactive
//
// Run `f` with no current computation, returning the return value
// of `f`.  Used to turn off reactivity for the duration of `f`,
// so that reactive data sources accessed by `f` will not result in any
// computations being invalidated.

/**
 * @summary Run a function without tracking dependencies.
 * @locus Client
 * @param {Function} func A function to call immediately.
 */
Tracker.nonreactive = function (f) {
  var previous = Tracker.currentComputation;
  Tracker._setCurrentComputation(null);
  try {
    return f();
  } finally {
    Tracker._setCurrentComputation(previous);
  }
};

// http://docs.meteor.com/#tracker_oninvalidate

/**
 * @summary Registers a new [`onInvalidate`](#computation_oninvalidate) callback on the current computation (which must exist), to be called immediately when the current computation is invalidated or stopped.
 * @locus Client
 * @param {Function} callback A callback function that will be invoked as `func(c)`, where `c` is the computation on which the callback is registered.
 */
Tracker.onInvalidate = function (f) {
  if (! Tracker.active)
    throw new Error("Tracker.onInvalidate requires a currentComputation");

  Tracker.currentComputation.onInvalidate(f);
};

// http://docs.meteor.com/#tracker_afterflush

/**
 * @summary Schedules a function to be called during the next flush, or later in the current flush if one is in progress, after all invalidated computations have been rerun.  The function will be run once and not on subsequent flushes unless `afterFlush` is called again.
 * @locus Client
 * @param {Function} callback A function to call at flush time.
 */
Tracker.afterFlush = function (f) {
  afterFlushCallbacks.push(f);
  Tracker._requireFlush();
};

module.exports = Tracker;
