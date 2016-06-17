var Tracer, Tracker, Type, assertType, emptyFunction, getArgProp, nextId, type;

require("isDev");

emptyFunction = require("emptyFunction");

assertType = require("assertType");

getArgProp = require("getArgProp");

Tracer = require("tracer");

Type = require("Type");

Tracker = require("./Tracker");

nextId = 1;

type = Type("Tracker_Computation");

type.optionTypes = {
  func: Function,
  async: Boolean.Maybe,
  keyPath: String.Maybe,
  onError: Function
};

type.optionDefaults = {
  async: true,
  onError: function(error) {
    throw error;
  }
};

type.defineValues({
  id: function() {
    return nextId++;
  },
  keyPath: getArgProp("keyPath"),
  isActive: false,
  isAsync: getArgProp("async"),
  isFirstRun: true,
  isInvalidated: false,
  _isRecomputing: false,
  _parent: function(options) {
    return options.parent || Tracker.currentComputation;
  },
  _func: getArgProp("func"),
  _onError: getArgProp("onError"),
  _invalidateCallbacks: function() {
    return [];
  },
  _stopCallbacks: function() {
    return [];
  },
  _trace: function() {
    if (isDev) {
      return emptyFunction;
    }
  }
});

type.initInstance(function() {
  return Tracker._computations[this.id] = this;
});

type.bindMethods(["stop"]);

type.defineMethods({
  start: function() {
    var error;
    if (this.isActive) {
      return;
    }
    this.isActive = true;
    try {
      this._compute();
    } catch (error1) {
      error = error1;
      this.stop();
    }
    this.isFirstRun = false;
    if (Tracker.isActive) {
      Tracker.onInvalidate(this.stop);
    }
  },
  invalidate: function() {
    if (this.isInvalidated) {
      return;
    }
    this.isInvalidated = true;
    isDev && (this._trace = Tracer("computation.invalidate()"));
    if (this.isActive) {
      if (!this.isAsync) {
        this._recompute();
      } else if (!this._isRecomputing) {
        Tracker._pendingComputations.push(this);
        Tracker._requireFlush();
      }
    }
    this._didInvalidate();
  },
  stop: function() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.invalidate();
    delete Tracker._computations[this.id];
    this._didStop();
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
    var outerComputation, wasComputing;
    this.isInvalidated = false;
    outerComputation = Tracker.currentComputation;
    Tracker._setCurrentComputation(this);
    wasComputing = Tracker._inCompute;
    Tracker._inCompute = true;
    try {
      return this._func(this);
    } finally {
      Tracker._setCurrentComputation(outerComputation);
      Tracker._inCompute = wasComputing;
    }
  },
  _needsRecompute: function() {
    return this.isInvalidated && this.isActive;
  },
  _recompute: function() {
    if (!this._needsRecompute()) {
      return;
    }
    this._isRecomputing = true;
    try {
      this._compute();
    } finally {
      this._isRecomputing = false;
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

//# sourceMappingURL=../../map/src/Computation.map
