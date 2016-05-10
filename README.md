
# tracker v2.0.0 ![stable](https://img.shields.io/badge/stability-stable-4EBA0F.svg?style=flat)

This library provides:

- A graph of reactive dependencies.

- Helpers for managing reactive dependencies.

### Tracker

The `Tracker` is a singleton that manages the graph of reactive dependencies.

[Learn more about the Tracker class.]()

### Tracker.Dependency

A `Tracker.Dependency` represents a reactive value that can be depended on.

[Learn more about the Dependency class.]()

### Tracker.Computation

A `Tracker.Computation` calls its assigned function whenever one of its
reactive dependencies is changed.

[Learn more about the Computation class.]()
