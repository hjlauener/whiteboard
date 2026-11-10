# Udon Whiteboard Script 1.0

One command per line: `command [ids…] key=value key="text with spaces"`. Lines starting with # are comments.
Coordinates: x grows to the right, y grows downwards; sizes in pixels. Ids name elements so that later commands can refer to them.
Colours: a name (black, white, gray, red, pink, violet, blue, cyan, teal, green, yellow, orange, light-gray, light-red, light-pink, light-violet, light-blue, light-cyan, light-teal, light-green, light-yellow, light-orange, transparent) or #rrggbb.
Booleans: yes/no. Line breaks in text: \n.

## Create

### rect
Creates a rectangle. Default size 160 x 80.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `x`: Left edge in board coordinates (y grows downwards).
- `y`: Top edge.
- `w`: Width.
- `h`: Height.
- `right`: Place to the right of this element (instead of x/y).
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).
- `text`: Text inside the element. Use "\n" for a line break.
- `stroke`: Line and text colour: a colour name or #rrggbb.
- `fill`: Background colour: a colour name, #rrggbb or transparent.
- `fillstyle`: How the background is filled. (solid | hachure | cross-hatch)
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.
- `round`: Rounded corners (yes/no).
- `font`: Font family (default serif). (serif | sans | hand | code)
- `size`: Font size. (S | M | L | XL | XXL)
- `align`: Text alignment. (left | center | right)

```
rect id=a x=0 y=0 w=200 h=100 text="Goal"
rect id=b right=a text="Next step" fill=light-blue
```

### ellipse
Creates a ellipse. Default size 160 x 80.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `x`: Left edge in board coordinates (y grows downwards).
- `y`: Top edge.
- `w`: Width.
- `h`: Height.
- `right`: Place to the right of this element (instead of x/y).
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).
- `text`: Text inside the element. Use "\n" for a line break.
- `stroke`: Line and text colour: a colour name or #rrggbb.
- `fill`: Background colour: a colour name, #rrggbb or transparent.
- `fillstyle`: How the background is filled. (solid | hachure | cross-hatch)
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.
- `round`: Rounded corners (yes/no).
- `font`: Font family (default serif). (serif | sans | hand | code)
- `size`: Font size. (S | M | L | XL | XXL)
- `align`: Text alignment. (left | center | right)

```
ellipse id=a x=0 y=0 w=200 h=100 text="Goal"
ellipse id=b right=a text="Next step" fill=light-blue
```

### diamond
Creates a diamond (rhombus), e.g. for decisions. Default size 160 x 80.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `x`: Left edge in board coordinates (y grows downwards).
- `y`: Top edge.
- `w`: Width.
- `h`: Height.
- `right`: Place to the right of this element (instead of x/y).
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).
- `text`: Text inside the element. Use "\n" for a line break.
- `stroke`: Line and text colour: a colour name or #rrggbb.
- `fill`: Background colour: a colour name, #rrggbb or transparent.
- `fillstyle`: How the background is filled. (solid | hachure | cross-hatch)
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.
- `round`: Rounded corners (yes/no).
- `font`: Font family (default serif). (serif | sans | hand | code)
- `size`: Font size. (S | M | L | XL | XXL)
- `align`: Text alignment. (left | center | right)

```
diamond id=a x=0 y=0 w=200 h=100 text="Goal"
diamond id=b right=a text="Next step" fill=light-blue
```

### note
Creates a sticky note: a light-yellow square with text. Default size 180 x 180.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `x`: Left edge in board coordinates (y grows downwards).
- `y`: Top edge.
- `w`: Width.
- `h`: Height.
- `right`: Place to the right of this element (instead of x/y).
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).
- `text`: Text inside the element. Use "\n" for a line break.
- `stroke`: Line and text colour: a colour name or #rrggbb.
- `fill`: Background colour: a colour name, #rrggbb or transparent.
- `fillstyle`: How the background is filled. (solid | hachure | cross-hatch)
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.
- `round`: Rounded corners (yes/no).
- `font`: Font family (default serif). (serif | sans | hand | code)
- `size`: Font size. (S | M | L | XL | XXL)
- `align`: Text alignment. (left | center | right)

```
note id=n1 x=0 y=0 text="Idea:\nask the students"
note id=n2 right=n1 fill=light-green text="Done"
```

### text
Creates free text without a frame.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `x`: Left edge in board coordinates (y grows downwards).
- `y`: Top edge.
- `right`: Place to the right of this element (instead of x/y).
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).
- `text` (required): The text.
- `stroke`: Text colour.
- `opacity`: Opacity in percent.
- `font`: Font family (default serif). (serif | sans | hand | code)
- `size`: Font size. (S | M | L | XL | XXL)
- `align`: Text alignment. (left | center | right)

```
text id=title x=0 y=-120 text="Introduction to law" size=XL
```

### arrow
Creates an arrow. With from/to it is attached to both elements and follows them when they are moved; otherwise give x1/y1/x2/y2.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `from`: Element where the arrow starts.
- `to`: Element where the arrow ends.
- `x1`: Start point x (without from).
- `y1`: Start point y.
- `x2`: End point x (without to).
- `y2`: End point y.
- `text`: Label on the arrow.
- `head`: Head at the end (default arrow). (arrow | triangle | bar | dot | none)
- `tail`: Head at the start (default none). (arrow | triangle | bar | dot | none)
- `stroke`: Line and text colour: a colour name or #rrggbb.
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.

```
arrow from=a to=b
arrow from=a to=b text="leads to" linestyle=dashed
arrow x1=0 y1=0 x2=200 y2=0 head=triangle
```

### line
Creates a line through points, or between two elements with from/to.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `points`: Points as "x,y x,y …" (at least two).
- `from`: Element where the line starts.
- `to`: Element where the line ends.
- `stroke`: Line and text colour: a colour name or #rrggbb.
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.

```
line points="0,300 600,300" linestyle=dashed stroke=gray
```

### draw
Creates a freehand stroke through the given points.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `points` (required): Points as "x,y x,y …" (at least two).
- `stroke`: Colour.
- `width`: Line width. (thin | bold | extra)
- `opacity`: Opacity in percent.

```
draw points="0,0 10,5 20,0 30,5" stroke=red
```

### frame
Creates a named frame (area). Elements listed in contains are put into the frame.

- `id`: Name for the new element, used by later commands (letters, digits, - and _). Optional.
- `x`: Left edge in board coordinates (y grows downwards).
- `y`: Top edge.
- `w`: Width.
- `h`: Height.
- `right`: Place to the right of this element (instead of x/y).
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).
- `title`: Name shown above the frame.
- `contains`: Ids of elements inside the frame, separated by spaces, e.g. "a b c".

```
frame id=f1 x=-40 y=-40 w=600 h=400 title="Group 1" contains="a b"
```

## Change

### move <id> …
Moves elements by dx/dy, or one element to x/y (top-left corner). Attached arrows follow.

- `dx`: Horizontal distance.
- `dy`: Vertical distance.
- `x`: New left edge (one element only).
- `y`: New top edge (one element only).
- `right`: Place to the right of this element.
- `left`: Place to the left of this element.
- `below`: Place below this element.
- `above`: Place above this element.
- `gap`: Distance for right/left/below/above (default 60).

```
move a dx=100 dy=0
move a b c dy=-50
move b below=a gap=40
```

### resize <id> …
Changes the size of an element (top-left corner stays).

- `w`: New width.
- `h`: New height.

```
resize a w=300 h=120
```

### rotate <id> …
Rotates elements to the given angle (degrees, clockwise).

- `angle` (required): Angle in degrees.

```
rotate a angle=15
```

### style <id> …
Changes colours and line style of elements.

- `stroke`: Line and text colour: a colour name or #rrggbb.
- `fill`: Background colour: a colour name, #rrggbb or transparent.
- `fillstyle`: How the background is filled. (solid | hachure | cross-hatch)
- `width`: Line width. (thin | bold | extra)
- `linestyle`: Line style. (solid | dashed | dotted)
- `rough`: Sloppiness: 0 clean, 1 sketchy, 2 very sketchy. (0 | 1 | 2)
- `opacity`: Opacity in percent.
- `round`: Rounded corners (yes/no).

```
style a b fill=light-red stroke=red
style c linestyle=dashed width=bold rough=0
```

### settext <id>
Replaces the text of an element (shape, note, text or arrow label).

- `text` (required): New text. Use "\n" for a line break.

```
settext a text="Revised goal"
```

### font <id> …
Changes font, size or alignment of the text of elements.

- `font`: Font family (default serif). (serif | sans | hand | code)
- `size`: Font size. (S | M | L | XL | XXL)
- `align`: Text alignment. (left | center | right)

```
font title size=XL font=serif
font a b align=left
```

### convert <id> …
Turns elements into another kind of shape; position, size, text, colours and attached arrows stay. Shapes (rect, ellipse, diamond, note) change among each other, arrows and lines among each other.

- `to` (required): New kind of element. (rect | ellipse | diamond | note | arrow | line)

```
convert a to=ellipse
convert b c to=note
convert link1 to=line
```

### delete <id> …
Deletes elements (and their text). Arrows attached to them stay but are detached.

```
delete a
delete b c
```

### link <id> …
Adds a web link to an element (empty url removes it).

- `url` (required): https:// address, or empty.

```
link a url="https://www.unibe.ch"
```

### lock <id> …
Locks elements so that they cannot be moved or changed by mistake.

```
lock title
```

### unlock <id> …
Unlocks elements.

```
unlock title
```

## Arrange

### group <id> <id> …
Groups elements so that they are selected and moved together.

- `id`: Name of the group; can be used like an element id afterwards.

```
group a b c id=g1
```

### ungroup <id> …
Removes the outermost group of the elements (or of the named group).

```
ungroup g1
```

### front <id> …
Brings elements to the front.

```
front a
```

### back <id> …
Sends elements to the back.

```
back f1
```

### align <id> <id> …
Aligns elements to each other.

- `edge` (required): Edge or centre line to align on. (left | center | right | top | middle | bottom)

```
align a b c edge=top
```

### distribute <id> <id> …
Distributes elements evenly between the first and the last one.

- `axis` (required): x = horizontally, y = vertically. (x | y)

```
distribute a b c d axis=x
```

## View and history

### select <id> …
Selects elements on the board (only for you, not for the others).

```
select a b
```

### view <id> …
Scrolls and zooms your view to elements, or to the whole board with "all" (only for you).

```
view all
view a b
```

### undo
Undoes your last change on the board (a whole script counts as one change).

```
undo
```

### redo
Redoes what undo has undone.

```
redo
```
