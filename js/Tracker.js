var Type, assert, assertType, type;

assertType = require("assertType");

assert = require("assert");

Type = require("Type");

type = Type("Tracker");

type.defineValues(function() {
  return {
    isActive: false,
    currentComputation: null,
    _computations: {},
    _pendingComputations: [],
    _afterFlushCallbacks: [],
    _willFlush: false,
    _inFlush: false,
    _inCompute: false
  };
});

type.defineMethods({
  flush: function(isAsync) {
    if (isAsync == null) {
      isAsync = false;
    }
    this._runFlush(isAsync);
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
  nonreactive: function(context, func) {
    var previous;
    if (arguments.length === 1) {
      func = context;
      context = null;
    }
    assertType(func, Function);
    previous = this.currentComputation;
    this._setCurrentComputation(null);
    try {
      return func.call(context);
    } finally {
      this._setCurrentComputation(previous);
    }
  },
  onInvalidate: function(callback) {
    assert(this.isActive, "'onInvalidate' cannot be called when 'isActive' is false!");
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
    this._willFlush = true;
    return setImmediate((function(_this) {
      return function() {
        return _this._runFlush(true);
      };
    })(this));
  },
  _runFlush: function(isAsync) {
    var callback, callbacks, computation, error, finishedTry, pending, recomputedCount;
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
          if (!isAsync) {
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
            GLOBAL.setImmediate(function() {
              throw error;
            });
          }
        }
      }
      return finishedTry = true;
    } finally {
      if (!finishedTry) {
        this._inFlush = false;
        this._runFlush(isAsync);
      }
      this._willFlush = false;
      this._inFlush = false;
      if (pending.length || callbacks.length) {
        assert(isAsync, "Only async flushing should end up here!");
        setTimeout(this._requireFlush, 10);
      }
    }
  }
});

module.exports = type.construct();

//# sourceMappingURL=map/Tracker.map
