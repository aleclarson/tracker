var Type, throwFailure, type;

throwFailure = require("failure").throwFailure;

Type = require("Type");

type = Type("Tracker");

type.defineValues({
  isActive: false,
  currentComputation: null,
  _computations: function() {
    return {};
  },
  _pendingComputations: function() {
    return [];
  },
  _afterFlushCallbacks: function() {
    return [];
  },
  _willFlush: false,
  _inFlush: false,
  _inCompute: false
});

type.bindMethods(["_runFlush", "_requireFlush"]);

type.defineMethods({
  flush: function(options) {
    if (options == null) {
      options = {};
    }
    if (options.finishSynchronously == null) {
      options.finishSynchronously = true;
    }
    this._runFlush(options);
  },
  autorun: function(func, options) {
    var computation;
    if (options == null) {
      options = {};
    }
    assertType(func, Function);
    options.func = func;
    computation = this.Computation(options);
    computation.start();
    return computation;
  },
  nonreactive: function(func) {
    var previous;
    assertType(func, Function);
    previous = this.currentComputation;
    this._setCurrentComputation(null);
    try {
      return func();
    } finally {
      this._setCurrentComputation(previous);
    }
  },
  onInvalidate: function(callback) {
    assert(this.isActive, "'onInvalidate' cannot be called when 'active' is false!");
    this.currentComputation.onInvalidate(callback);
  },
  afterFlush: function(callback) {
    assertType(callback, Function);
    this._afterFlushCallbacks.push(callback);
    this._requireFlush();
  },
  _setCurrentComputation: function(computation) {
    this.currentComputation = computation;
    return this.isActive = computation != null;
  },
  _requireFlush: function() {
    if (this._willFlush) {
      return;
    }
    setImmediate(this._runFlush);
    return this._willFlush = true;
  },
  _runFlush: function(options) {
    var callback, callbacks, computation, error, finishedTry, pending, recomputedCount;
    if (options == null) {
      options = {};
    }
    assert(!this._inFlush, {
      reason: "Cannot call 'flush' during a flush!"
    });
    assert(!this._inCompute, {
      reason: "Cannot call 'flush' during a computation!"
    });
    this._inFlush = true;
    this._willFlush = true;
    pending = this._pendingComputations;
    callbacks = this._afterFlushCallbacks;
    recomputedCount = 0;
    finishedTry = false;
    try {
      while (pending.length || callbacks.length) {
        while (pending.length) {
          computation = pending.shift();
          computation._recompute();
          if (computation._needsRecompute()) {
            pending.unshift(computation);
          }
          if (options.finishSynchronously) {
            continue;
          }
          recomputedCount += 1;
          if (recomputedCount <= 1000) {
            continue;
          }
          finishedTry = true;
          return;
        }
        if (callbacks.length) {
          callback = callbacks.shift();
          try {
            callback();
          } catch (error1) {
            error = error1;
            throwFailure(error, {
              callback: callback
            });
          }
        }
      }
      return finishedTry = true;
    } finally {
      if (!finishedTry) {
        this._inFlush = false;
        this._runFlush(options);
      }
      this._willFlush = false;
      this._inFlush = false;
      if (pending.length || callbacks.length) {
        assert(!options.finishSynchronously);
        setTimeout(this._requireFlush, 10);
      }
    }
  }
});

module.exports = type.construct();

//# sourceMappingURL=../../map/src/Tracker.map
