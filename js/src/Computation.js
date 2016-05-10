var Tracer, Tracker, Type, nextId, throwFailure, type;

require("isDev");

throwFailure = require("failure").throwFailure;

Tracer = require("tracer");

Type = require("Type");

Tracker = require("./Tracker");

nextId = 1;

type = Type("Tracker_Computation");

type.optionTypes = {
  func: Function,
  onError: Function,
  async: Boolean.Maybe,
  keyPath: String.Maybe
};

type.defineValues({
  id: function() {
    return nextId++;
  },
  keyPath: function(options) {
    return options.keyPath;
  },
  isActive: false,
  isInvalidated: false,
  isFirstRun: true,
  isAsync: function(options) {
    return options.async !== false;
  },
  _recomputing: false,
  _func: function(options) {
    return options.func;
  },
  _parent: function(options) {
    return options.parent || Tracker.currentComputation;
  },
  _errorCallback: function(options) {
    return options.onError;
  },
  _invalidateCallbacks: function() {
    return [];
  },
  _stopCallbacks: function() {
    return [];
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
      this._onError(error);
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
    if (!this.isAsync) {
      if (this.isActive) {
        this._onInvalidate();
        this._recompute();
      }
      return;
    }
    if (isDev) {
      this._trace = Tracer("When computation was invalidated");
    }
    if (!(this._recomputing || !this.isActive)) {
      Tracker._requireFlush();
      Tracker._pendingComputations.push(this);
    }
    this._onInvalidate();
  },
  stop: function() {
    var self;
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.invalidate();
    delete Tracker._computations[this.id];
    self = this;
    Tracker.nonreactive(function() {
      var callback, i, len, ref;
      ref = this._stopCallbacks;
      for (i = 0, len = ref.length; i < len; i++) {
        callback = ref[i];
        callback(self);
      }
    });
    this._stopCallbacks.length = 0;
  },
  onInvalidate: function(callback) {
    assertType(callback, Function);
    if (!this.isInvalidated) {
      this._invalidateCallbacks.push(callback);
      return;
    }
    Tracker.nonreactive(function() {
      return callback(self);
    });
  },
  onStop: function(callback) {
    assertType(callback, Function);
    if (this.isActive) {
      this._stopCallbacks.push(callback);
      return;
    }
    Tracker.nonreactive(function() {
      return callback(self);
    });
  },
  _onInvalidate: function() {
    var self;
    self = this;
    Tracker.nonreactive(function() {
      var callback, i, len, ref;
      ref = this._invalidateCallbacks;
      for (i = 0, len = ref.length; i < len; i++) {
        callback = ref[i];
        callback(self);
      }
    });
    this._invalidateCallbacks.length = 0;
  },
  _compute: function() {
    var previous, previousInCompute;
    this.isInvalidated = false;
    previous = Tracker.currentComputation;
    Tracker._setCurrentComputation(this);
    previousInCompute = Tracker._inCompute;
    Tracker._inCompute = true;
    try {
      return this._func(this);
    } finally {
      Tracker._setCurrentComputation(previous);
      Tracker._inCompute = previousInCompute;
    }
  },
  _needsRecompute: function() {
    return this.isInvalidated && this.isActive;
  },
  _recompute: function() {
    var error;
    this._recomputing = true;
    try {
      if (this._needsRecompute()) {
        try {
          return this._compute();
        } catch (error1) {
          error = error1;
          return this._onError(error);
        }
      }
    } finally {
      this._recomputing = false;
    }
  },
  _onError: function(error) {
    var data;
    if (isDev && this._trace) {
      data = {
        stack: this._trace()
      };
    }
    if (this._errorCallback) {
      return this._errorCallback(error, data);
    } else {
      return throwFailure(error, data);
    }
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/Computation.map
