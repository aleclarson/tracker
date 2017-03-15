// Generated by CoffeeScript 1.12.4
var Tracer, Tracker, Type, assertType, emptyFunction, isDev, nextId, type;

emptyFunction = require("emptyFunction");

assertType = require("assertType");

Tracer = require("tracer");

isDev = require("isDev");

Type = require("Type");

Tracker = require("./Tracker");

nextId = 1;

type = Type("Tracker_Computation");

type.defineArgs(function() {
  return {
    required: [true, false],
    types: [
      Function, {
        sync: Boolean.Maybe,
        onError: Function.Maybe,
        keyPath: String.Maybe
      }
    ]
  };
});

type.defineValues(function(func, options) {
  if (options == null) {
    options = {};
  }
  return {
    id: nextId++,
    keyPath: options.keyPath,
    isActive: false,
    isInvalidated: false,
    isAsync: !options.sync,
    _func: func,
    _parent: options.parent || Tracker.currentComputation,
    _onError: options.onError,
    _isRecomputing: false,
    _invalidateCallbacks: [],
    _stopCallbacks: [],
    _trace: isDev && emptyFunction
  };
});

type.initInstance(function() {
  return Tracker._computations[this.id] = this;
});

type.defineBoundMethods({
  stop: function() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.invalidate();
    delete Tracker._computations[this.id];
    this._didStop();
  }
});

type.defineMethods({
  start: function() {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    this._compute();
    if (Tracker.isActive) {
      Tracker.onInvalidate(this.stop);
    }
  },
  invalidate: function() {
    if (this.isInvalidated) {
      return;
    }
    this.isInvalidated = true;
    this._didInvalidate();
    if (isDev) {
      this._trace = Tracer("computation.invalidate()");
    }
    if (!this.isActive) {
      return;
    }
    if (this.isAsync) {
      if (this._isRecomputing) {
        return;
      }
      Tracker._pendingComputations.push(this);
      Tracker._requireFlush();
      return;
    }
    this._recompute();
  },
  onInvalidate: function(callback) {
    assertType(callback, Function);
    if (this.isInvalidated) {
      Tracker.nonreactive(callback);
      return;
    }
    this._invalidateCallbacks.push(callback);
  },
  onStop: function(callback) {
    assertType(callback, Function);
    if (this.isActive) {
      this._stopCallbacks.push(callback);
      return;
    }
    Tracker.nonreactive(callback);
  },
  _compute: function() {
    var error, outerComputation, wasComputing;
    this.isInvalidated = false;
    outerComputation = Tracker.currentComputation;
    Tracker._setCurrentComputation(this);
    wasComputing = Tracker._inCompute;
    Tracker._inCompute = true;
    try {
      return this._func(this);
    } catch (error1) {
      error = error1;
      this.stop();
      if (this._onError) {
        return this._onError(error);
      } else {
        throw error;
      }
    } finally {
      Tracker._setCurrentComputation(outerComputation);
      Tracker._inCompute = wasComputing;
    }
  },
  _needsRecompute: function() {
    return this.isInvalidated && this.isActive;
  },
  _recompute: function() {
    if (this._needsRecompute()) {
      this._isRecomputing = true;
      try {
        return this._compute();
      } finally {
        this._isRecomputing = false;
      }
    }
  },
  _didStop: function() {
    var callbacks;
    callbacks = this._stopCallbacks;
    if (!callbacks.length) {
      return;
    }
    Tracker.nonreactive(function() {
      var callback, i, len;
      for (i = 0, len = callbacks.length; i < len; i++) {
        callback = callbacks[i];
        callback();
      }
      return callbacks.length = 0;
    });
  },
  _didInvalidate: function() {
    var callbacks;
    callbacks = this._invalidateCallbacks;
    if (!callbacks.length) {
      return;
    }
    Tracker.nonreactive(function() {
      var callback, i, len;
      for (i = 0, len = callbacks.length; i < len; i++) {
        callback = callbacks[i];
        callback();
      }
      return callbacks.length = 0;
    });
  }
});

module.exports = type.build();
