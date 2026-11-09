# Styling Guide v1

All rules below are **mandatory** for every file in the project. These cover every language, no matter HTML, or C++. The examples may use HTML, CSS, JavaScript, C, C++, and Python but that is because those are the only languages I know.

---

## File Structure

- Encoding: **UTF-8 only**.
- Indentation: **4 spaces = 1 tab**. No tab characters.
- File names: `FirstLetterHasToBeCapital.lowercaseextension`
  (e.g. `Main.cpp`, `Utils.h`, `Config.json`).

---

## Reusable Components

Any app component that is used in more than one place must have its own
dedicated file (e.g. `ChatPanel.html`, `Sidebar.html`, `Settings.html`).

- Each component file links to **`Style.css`** (Style.css is just an example) for styling and
  **`Main.js`** (Main.js is just an example) for functionality.
- This rule applies to **app-specific** reusable components (panels, modals,
  cards, layout sections, etc.).
- This does **not** apply to standard UI elements such as buttons, inputs,
  text areas, links, or other native HTML controls. Those are written inline
  where they are needed.

---

## Imports & Includes

- After **any** import/`#include` block, leave **3 blank lines** before the next code.
- For files inside the project, always use the full relative path:
  `#include "DIRECTORY/FILE.EXTENSION"`.
- After a `#define`, `#ifndef`, or `#ifdef`, do **not** leave any blank lines
  before the next `#include`.

---

## Code Style

- **PascalCase for everything:** (classes, functions, variables, constants,
  parameters, file names).
- **Method signature:** opening `{` goes on the **same line**, separated from the
  method by **exactly 1 space**.
- **No magic numbers:** Every numeric literal must be a named constant.
- **No memory leaks:** All allocations must have a matching free/delete/scope-managed owner.
- **No unnecessary decimals:** Write `123`, not `123.0`.
- **Number endings:** numeric literals must end in `0`, `1`, `3`, `5`, `7` or `9`. These do not apply to numbers in text.
  (A trailing `0` is always allowed.)

---

## Spacing Between Sections

A function is made up of **sections**. Each section does one thing
(declare variables, perform a calculation, handle an error, clean up,
return a value, etc.).

- Every section is separated from the next section by **exactly one
  blank line**. This applies to all functions, regardless of size.
- Lines that belong to the **same** section stay together with no
  blank lines between them.
- Sections link together to complete the function's purpose, but they
  are always visually separated from one another.

**Example:**
``` cpp
void ProcessData() {
    // This is the variable section
    int X = 0;
    int Y = 1;
    int Z = X + Y;

    // This is the calculation section
    DoSomething(Z);

    // This is the output section, you get your output
    return Z;
}
```

**Wrong (sections not separated):**
``` cpp
void ProcessData() {
    int X = 0;
    int Y = 1;
    int Z = X + Y;
    DoSomething(Z);
    return Z;
}

// Allocate and initialise buffer
int BufferSize = Data.Size 2;
char Buffer = new char[BufferSize];
ZeroMemory(Buffer, BufferSize);

// Calculate checksum
int Checksum = 0;
for (int I = 0; I < BufferSize; I += 1) {
    Checksum += Buffer[I];
}
```

**Example (wrong — blank lines inside a single task):**
``` cpp
void ProcessData() {
    int BufferSize = Data.Size * 2;    

    char* Buffer = new char[BufferSize];

    ZeroMemory(Buffer, BufferSize);
}
```

---

## Comments

**Comment rules in general:** (for both inline and block comments)

- Written in **3rd person** (e.g. "Initialises the buffer.", not "I initialise…").

**Block comments:** (describing a function, section, or multiple lines):
- Must have **one blank line above** unless they are at the start of a function/method/struct etc.
- Must have **no blank line below** (the code follows immediately).

**Inline comments:** (describing the single line they refer to):
- Sit **directly next to** that line (trailing `// …`) or **immediately above** it
  with **no blank line** in between.
---

## Namespace Template (entry-point file only)
``` cpp
#include "xxx/xxx.xxx"


using namespace xxx;


int Main() { ...
```