// ------------------------------------------------------------
// Starting notes array (exactly as provided)
// ------------------------------------------------------------
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// ------------------------------------------------------------
// 1. searchNotes(word) – case‑insensitive search in text
// Uses filter, toLowerCase, includes.
// ------------------------------------------------------------
function searchNotes(word) {
  const lowerWord = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(lowerWord));
}

// ------------------------------------------------------------
// 2. longestNote() – returns note with most characters, or null
// Handles empty array first.
// ------------------------------------------------------------
function longestNote() {
  if (notes.length === 0) return null;

  let longest = notes[0];
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].text.length > longest.text.length) {
      longest = notes[i];
    }
  }
  return longest;
}

// ------------------------------------------------------------
// 3. countByCategory() – returns object with counts per category
// Loops over notes, increments a counter in an object.
// ------------------------------------------------------------
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    const cat = note.category;
    if (counts[cat] === undefined) {
      counts[cat] = 1;
    } else {
      counts[cat]++;
    }
  }
  return counts;
}

// ------------------------------------------------------------
// 4. getSummary() – returns sentence like "5 notes: 2 personal, 1 work, 2 study."
// Uses countByCategory and template literal.
// Handles singular "note" for exactly one note.
// ------------------------------------------------------------
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;

  // Build "X category" parts in consistent order: personal, work, study
  const parts = [];
  const order = ["personal", "work", "study"];

  for (const cat of order) {
    const count = counts[cat] || 0;
    if (count > 0) {
      parts.push(`${count} ${cat}`);
    }
  }

  // Note: if there are unknown categories they are ignored in the summary,
  // but the instructions only expect personal, work, study.
  const totalWord = total === 1 ? "note" : "notes";
  const details = parts.join(", ");

  return `${total} ${totalWord}: ${details}.`;
}

// ------------------------------------------------------------
// 5. isDuplicate(text) – true if a note with same trimmed lower‑case text exists
// Uses some, comparing trimmed lower-case text.
// ------------------------------------------------------------
function isDuplicate(text) {
  if (typeof text !== "string") return false; // safety for non‑string

  const normalized = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === normalized);
}

// ------------------------------------------------------------
// 6. addNote(text, category) – validates and adds note if:
// - text length between 1 and 200 (after trim? we check on raw length, but we trim for duplicate; let's keep length on original text but with no extra spaces? The spec says "1–200 characters", we interpret as the trimmed text length? Actually better: use trimmed text for length and storage to avoid extra spaces issues? But instructions: "adds a note only if it is 1–200 characters, is not a duplicate and the category is one of personal, work or study." We'll check the length of the provided text (trimmed? Many implementations check raw length, but "extra spaces" are mentioned for duplicate. To be safe, we'll trim the text before checking length and storing? But the instructions say "adds a note only if it is 1–200 characters" – typically the text as given. I'll use the trimmed version for both length and storage to avoid edge cases with spaces.)
// - returns true when added, false otherwise, logging the reason.
// ------------------------------------------------------------
function addNote(text, category) {
  // Trim the text to remove leading/trailing spaces
  const trimmedText = typeof text === "string" ? text.trim() : "";

  // Check length (1–200 characters) using trimmed text
  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log(
      `❌ addNote failed: text length must be 1–200 characters (got ${trimmedText.length}).`
    );
    return false;
  }

  // Check category
  const validCategories = ["personal", "work", "study"];
  if (!validCategories.includes(category)) {
    console.log(
      `❌ addNote failed: category must be one of ${validCategories.join( ", " )}.`
    );
    return false;
  }

  // Check duplicate (isDuplicate uses trimmed lower-case comparison)
  if (isDuplicate(trimmedText)) {
    console.log(
      `❌ addNote failed: duplicate note (ignoring case and extra spaces).`
    );
    return false;
  }

  // All good – add the note
  const newId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
  notes.push({ id: newId, text: trimmedText, category });
  console.log(
    `✅ addNote succeeded: "${trimmedText}" (${category}) added with id ${newId}.`
  );
  return true;
}

// ============================================================
// TESTING EVERY FUNCTION WITH console.log (normal + edge cases)
// ============================================================

console.log("--- 1. searchNotes tests ---");
console.log('searchNotes("milk") =>', searchNotes("milk"));
// Expected: [ { id: 1, text: 'Buy milk and bread', category: 'personal' } ]

console.log('searchNotes("JAVASCRIPT") =>', searchNotes("JAVASCRIPT"));
// Expected: [ { id: 4, text: 'Revise JavaScript arrays', category: 'study' } ]

console.log('searchNotes("xyz") =>', searchNotes("xyz"));
// Expected: [] (edge case: no results)

console.log("\n--- 2. longestNote tests ---");
console.log("longestNote() =>", longestNote());
// Expected: { id: 3, text: 'Email the project report to Grace', category: 'work' } (36 chars)

// Edge case: temporarily empty notes array, then restore
const backupNotes = [...notes];
notes = [];
console.log("longestNote() on empty array =>", longestNote());
// Expected: null
notes = backupNotes; // restore

console.log("\n--- 3. countByCategory tests ---");
console.log("countByCategory() =>", countByCategory());
// Expected: { personal: 2, work: 1, study: 2 }

// Edge case: add a note in a new category? Not allowed by addNote, but manually test
notes.push({ id: 99, text: "Temp note", category: "other" });
console.log('countByCategory() with "other" =>', countByCategory());
// Expected: { personal: 2, work: 1, study: 2, other: 1 }
notes.pop(); // remove temp note

console.log("\n--- 4. getSummary tests ---");
console.log("getSummary() =>", getSummary());
// Expected: "5 notes: 2 personal, 1 work, 2 study."

// Edge case: one note only
const backupNotes2 = [...notes];
notes = [{ id: 100, text: "Single note", category: "personal" }];
console.log("getSummary() with 1 note =>", getSummary());
// Expected: "1 note: 1 personal."
notes = backupNotes2;

console.log("\n--- 5. isDuplicate tests ---");
console.log(
  'isDuplicate("Buy milk and bread") =>',
  isDuplicate("Buy milk and bread")
);
// Expected: true

console.log(
  'isDuplicate(" buy MILK and bread ") =>',
  isDuplicate(" buy MILK and bread ")
);
// Expected: true (ignores case and extra spaces)

console.log(
  'isDuplicate("This text does not exist") =>',
  isDuplicate("This text does not exist")
);
// Expected: false

console.log("\n--- 6. addNote tests ---");
// Normal case: valid, non-duplicate, valid category
console.log(
  'addNote("New study task", "study") =>',
  addNote("New study task", "study")
);
// Expected: true, and note added (id 6)

// Edge case: duplicate (after trim/lowercase)
console.log(
  'addNote(" buy MILK and bread ", "personal") =>',
  addNote(" buy MILK and bread ", "personal")
);
// Expected: false, logs duplicate reason

// Edge case: invalid category
console.log('addNote("Some text", "hobby") =>', addNote("Some text", "hobby"));
// Expected: false, logs category reason

// Edge case: text too long (over 200 chars)
const longText = "a".repeat(201);
console.log('addNote(201 chars, "work") =>', addNote(longText, "work"));
// Expected: false, logs length reason

// Edge case: text too short (empty after trim)
console.log('addNote(" ", "work") =>', addNote(" ", "work"));
// Expected: false, logs length reason

// Display final notes array for transparency
console.log("\n--- Final notes array after tests ---");
console.log(notes);
// Expected: original 5 notes + "New study task" (id 6) added.
// (The duplicate attempt and invalid ones were not added.)