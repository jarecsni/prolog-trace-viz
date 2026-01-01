# Roadmap

This document tracks planned features, improvements, and ideas for future releases.

---

## Planned Features

(No features currently planned)

---

## Improvements

Small enhancements to existing functionality.

### Suppress result line for non-binding predicates
**Priority**: Low  
**Effort**: Small

Built-in predicates like `>/2` and `is/2` show `=> ? = ...` which is misleading since they don't bind an output variable in the traditional sense. Should detect these and either suppress the result line or show a more appropriate format.

---

## Ideas / Backlog

Ideas that need more exploration before becoming planned features.

### Output Formats
- SVG Timeline Visualisation (inline SVG with connection arrows)
- Interactive HTML output with collapsible sections
- Export to other formats (PNG, PDF)

### Prolog Support
- Support for more Prolog systems (GNU Prolog, SICStus)

### Analysis Features
- Performance profiling visualisation (execution time per predicate)
- Diff mode to compare two execution traces

---

## Contributing

Have a feature idea? Open an issue on GitHub with:
- Clear description of the feature
- Use case / problem it solves
- Any implementation ideas

