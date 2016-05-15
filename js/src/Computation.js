var Event, Tracer, Tracker, Type, assertType, getArgProp, nextId, throwFailure, type;

require("isDev");

throwFailure = require("failure").throwFailure;

assertType = require("assertType");

getArgProp = require("getArgProp");

Tracer = require("tracer");

Event = require("event");

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
  onError: throwFailure
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
  _recomputing: false,
  _parent: function(options) {
    return options.parent || Tracker.currentComputation;
  },
  _func: getArgProp("func"),
  _onError: getArgProp("onError"),
  _didInvalidate: function() {
    return Event();
  },
  _didStop: function() {
    return Event();
  },
  _trace: isDev ? null : void 0
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
      this._fail(error);
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
        this._invalidate();
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
    this._invalidate();
  },
  stop: function() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.invalidate();
    delete Tracker._computations[this.id];
    if (!this._didStop.listenerCount) {
      return;
    }
    Tracker.nonreactive((function(_this) {
      return function() {
        _this._didStop.emit();
        return _this._didStop.reset();
      };
    })(this));
  },
  onInvalidate: function(callback) {
    assertType(callback, Function);
    if (this.isInvalidated) {
      Tracker.nonreactive(callback);
    } else {
      this._didInvalidate(callback);
    }
  },
  onStop: function(callback) {
    assertType(callback, Function);
    if (!this.isActive) {
      Tracker.nonreactive(callback);
    } else {
      this._didStop(callback);
    }
  },
  _invalidate: function() {
    if (!this._didInvalidate.listenerCount) {
      return;
    }
    Tracker.nonreactive((function(_this) {
      return function() {
        _this._didInvalidate.emit();
        return _this._didInvalidate.reset();
      };
    })(this));
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
          return this._fail(error);
        }
      }
    } finally {
      this._recomputing = false;
    }
  },
  _fail: function(error) {
    var meta;
    if (isDev && this._trace) {
      meta = {
        stack: this._trace()
      };
    }
    return this.didFail.emit(error, meta);
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/Computation.map
