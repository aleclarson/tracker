var Tracker, Type, type;

Type = require("Type");

Tracker = require("./Tracker");

type = Type("Tracker_Dependency");

type.defineValues({
  _dependentsById: function() {
    return {};
  }
});

type.defineMethods({
  depend: function(computation) {
    var id, self;
    if (!computation) {
      if (!Tracker.isActive) {
        return false;
      }
      computation = Tracker.currentComputation;
    }
    id = computation.id;
    self = this;
    if (!this._dependentsById[id]) {
      this._dependentsById[id] = computation;
      computation.onInvalidate((function(_this) {
        return function() {
          return delete _this._dependentsById[id];
        };
      })(this));
      return true;
    }
    return false;
  },
  changed: function() {
    var computation, id, ref;
    ref = this._dependentsById;
    for (id in ref) {
      computation = ref[id];
      computation.invalidate();
    }
  },
  hasDependents: function() {
    return Object.keys(this._dependentsById).length > 0;
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/Dependency.map
