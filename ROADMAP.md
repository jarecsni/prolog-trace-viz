# Roadmap

This document tracks planned features and improvements for future releases.

## Format

Each feature includes:
- **Priority**: High / Medium / Low
- **Effort**: Small / Medium / Large
- **Status**: Planned / In Progress / Completed
- **Description**: What the feature does
- **Rationale**: Why it's needed
- **Notes**: Implementation considerations

---

## Planned Features

### Mermaid Sequence Diagrams for Timeline

**Priority**: Medium  
**Effort**: Medium  
**Status**: Planned

**Description**:  
Replace the current character-based timeline visualization with inline SVG diagrams embedded directly in the markdown output. This would make the execution timeline more visually appealing with proper connection arrows showing subgoal relationships.

**Rationale**:  
The current ASCII-art timeline (using `┌─`, `│`, `└─` characters) is functional but lacks visual clarity for complex execution flows. Custom SVG rendering would provide:
- Full control over box positioning (strict left-aligned vertical layout)
- Curved arrows connecting related steps (subgoal spawning, completion, continuation)
- Color-coded boxes and arrows for different event types
- Professional appearance while maintaining the sequential structure
- Native rendering in GitHub, GitLab, and markdown viewers

**Implementation Approach**:

Generate inline SVG directly in the markdown output. The SVG will be created by a new `svg-timeline-generator.ts` module that:
1. Positions boxes in strict vertical layout (left-aligned, fixed x-position)
2. Adds connection ports on boxes where subgoals spawn
3. Draws curved arrows between related steps using SVG paths
4. Applies color coding and styling

**Technical Details**:
- Each timeline step becomes an SVG `<rect>` with `<text>` elements
- Connection ports are small `<circle>` elements on box edges
- Arrows are `<path>` elements with quadratic curves (Q command)
- Different arrow styles: solid (sequential), dashed (back-reference), dotted (variable flow)
- Arrow colors: blue (subgoal tracking), green (completion), orange (spawning)

**Example Output**:

The markdown file would contain inline SVG like this:

<svg width="800" height="1400" xmlns="http://www.w3.org/2000/svg">
  <!-- Define arrow markers -->
  <defs>
    <marker id="arrowblue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#2196f3" />
    </marker>
    <marker id="arrowgreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#4caf50" />
    </marker>
  </defs>
  
  <!-- Step 1: CALL factorial(3, X) -->
  <rect x="50" y="50" width="650" height="70" fill="#fff9e6" stroke="#ffa500" stroke-width="2" rx="5"/>
  <text x="70" y="75" font-family="monospace" font-size="14" fill="#333">📞 Step 1: CALL factorial(3, X)</text>
  <text x="70" y="95" font-family="monospace" font-size="12" fill="#666">🔍 N=3, R=X</text>
  <text x="70" y="110" font-family="monospace" font-size="12" fill="#666">📋 Spawns: 1.1, 1.2, 1.3, 1.4</text>
  <circle cx="710" cy="85" r="4" fill="#2196f3"/>
  
  <!-- Step 2: CALL 3>0 (solving 1.1) -->
  <rect x="50" y="140" width="650" height="50" fill="#fff9e6" stroke="#ffa500" stroke-width="2" rx="5"/>
  <text x="70" y="165" font-family="monospace" font-size="14" fill="#333">📞 Step 2: CALL 3&gt;0</text>
  <text x="70" y="180" font-family="monospace" font-size="12" fill="#666">◀── Solving 1.1</text>
  
  <!-- Arrow from Step 2 back to Step 1 (solving subgoal) -->
  <path d="M 710 165 Q 750 122 710 85" stroke="#2196f3" stroke-width="2" fill="none" stroke-dasharray="5,5" marker-end="url(#arrowblue)"/>
  
  <!-- Step 3: EXIT 3>0 (completed 1.1) -->
  <rect x="50" y="210" width="650" height="50" fill="#e8f5e9" stroke="#4caf50" stroke-width="2" rx="5"/>
  <text x="70" y="235" font-family="monospace" font-size="14" fill="#333">✅ Step 3: EXIT 3&gt;0</text>
  <text x="70" y="250" font-family="monospace" font-size="12" fill="#666">◀── Completed 1.1</text>
  
  <!-- Arrow from Step 3 back to Step 1 (completing subgoal) -->
  <path d="M 710 235 Q 770 160 710 85" stroke="#4caf50" stroke-width="2" fill="none" marker-end="url(#arrowgreen)"/>
  
  <!-- Step 4: CALL N1 is 3-1 (solving 1.2) -->
  <rect x="50" y="280" width="650" height="50" fill="#fff9e6" stroke="#ffa500" stroke-width="2" rx="5"/>
  <text x="70" y="305" font-family="monospace" font-size="14" fill="#333">📞 Step 4: CALL N1 is 3-1</text>
  <text x="70" y="320" font-family="monospace" font-size="12" fill="#666">◀── Solving 1.2</text>
  
  <!-- Arrow from Step 4 back to Step 1 -->
  <path d="M 710 305 Q 790 195 710 85" stroke="#2196f3" stroke-width="2" fill="none" stroke-dasharray="5,5" marker-end="url(#arrowblue)"/>
  
  <!-- Step 5: EXIT N1=2 (completed 1.2) -->
  <rect x="50" y="350" width="650" height="50" fill="#e8f5e9" stroke="#4caf50" stroke-width="2" rx="5"/>
  <text x="70" y="375" font-family="monospace" font-size="14" fill="#333">✅ Step 5: EXIT N1=2</text>
  <text x="70" y="390" font-family="monospace" font-size="12" fill="#666">◀── Completed 1.2</text>
  
  <!-- Arrow from Step 5 back to Step 1 -->
  <path d="M 710 375 Q 810 230 710 85" stroke="#4caf50" stroke-width="2" fill="none" marker-end="url(#arrowgreen)"/>
  
  <!-- Step 6: CALL factorial(2, R1) (solving 1.3) -->
  <rect x="50" y="420" width="650" height="70" fill="#e3f2fd" stroke="#2196f3" stroke-width="2" rx="5"/>
  <text x="70" y="445" font-family="monospace" font-size="14" fill="#333">📞 Step 6: CALL factorial(2, R1)</text>
  <text x="70" y="465" font-family="monospace" font-size="12" fill="#666">◀── Solving 1.3 (Recursive)</text>
  <text x="70" y="480" font-family="monospace" font-size="12" fill="#666">🔍 N=2, R=R1</text>
  <circle cx="710" cy="455" r="4" fill="#2196f3"/>
  
  <!-- Arrow from Step 6 back to Step 1 -->
  <path d="M 710 455 Q 830 270 710 85" stroke="#2196f3" stroke-width="2" fill="none" stroke-dasharray="5,5" marker-end="url(#arrowblue)"/>
  
  <!-- Continuation indicator -->
  <text x="350" y="530" font-family="monospace" font-size="14" fill="#999" text-anchor="middle">... (steps 7-25 continue) ...</text>
  
  <!-- Step 26: EXIT factorial(3, 6) -->
  <rect x="50" y="560" width="650" height="70" fill="#e8f5e9" stroke="#4caf50" stroke-width="2" rx="5"/>
  <text x="70" y="585" font-family="monospace" font-size="14" fill="#333">✅ Step 26: EXIT factorial(3, 6)</text>
  <text x="70" y="605" font-family="monospace" font-size="12" fill="#666">🔄 R from Step 1 → 6</text>
  <text x="70" y="620" font-family="monospace" font-size="12" fill="#666">◀── Completed original goal</text>
  
  <!-- Arrow from Step 26 back to Step 1 (final completion) -->
  <path d="M 50 595 Q 20 340 50 85" stroke="#4caf50" stroke-width="3" fill="none" marker-end="url(#arrowgreen)"/>
</svg>

**Key Features**:
- **Strict vertical layout**: All boxes at x=50, stacked vertically with fixed spacing
- **Left-aligned content**: Text positioned consistently within boxes
- **Connection ports**: Small circles on boxes where subgoals spawn
- **Curved arrows**: Show relationships between steps (spawning, solving, completing)
- **Color coding**: 
  - Orange boxes (CALL), Green boxes (EXIT), Blue boxes (Recursive calls)
  - Blue dashed arrows (solving subgoal), Green solid arrows (completing subgoal)
- **Icons**: 📞 CALL, ✅ EXIT, 🔍 Pattern Match, 📋 Subgoals, 🔄 Variable Flow
- **Maintains structure**: Same sequential information as ASCII version

**Benefits**:
- Professional, clean appearance
- Visual connections make execution flow immediately clear
- Renders natively in GitHub/GitLab markdown
- Full control over positioning and styling
- Scales to complex traces with many subgoals

---

## Completed Features

### Variable Flow Tracking
**Completed**: v2.0.0 (2025-12-21)

Shows how variables bind and flow across execution steps with notes like "R from Step 11 is now bound to 1".

---

## Ideas / Backlog

Ideas that need more exploration before becoming planned features:

- Interactive HTML output with collapsible sections
- Support for more Prolog systems (GNU Prolog, SICStus)
- Performance profiling visualization (execution time per predicate)
- Diff mode to compare two execution traces
- Export to other formats (SVG, PNG, PDF)

---

## Contributing

Have a feature idea? Open an issue on GitHub with:
- Clear description of the feature
- Use case / problem it solves
- Any implementation ideas

