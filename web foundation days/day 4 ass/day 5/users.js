
const loadUsersButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const API_URL = "https://jsonplaceholder.typicode.com/users";

let users = [];

async function loadUsers() {
  loadUsersButton.disabled = true;
  statusMessage.textContent = "Loading users...";
  usersList.replaceChildren();

  try {
    const response = await fetch(API_URL);

    // Check whether the server returned a successful response.
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("The API returned invalid user data.");
    }

    // Store users so filtering does not need another request.
    users = data;

    renderUsers(users);

    statusMessage.textContent =
      `Successfully loaded ${users.length} users.`;
  } catch (error) {
    users = [];
    usersList.replaceChildren();

    statusMessage.textContent =
      "Unable to load users. Please check your connection and try again.";

    console.error("Error loading users:", error);
  } finally {
    // Always re-enable the button, whether the request succeeds or fails.
    loadUsersButton.disabled = false;
  }
}

function renderUsers(list) {
  usersList.replaceChildren();

  if (list.length === 0) {
    statusMessage.textContent = "No users match your filter.";
    return;
  }

  list.forEach((user) => {
    const item = document.createElement("li");
    item.className = "user-card";

    const name = document.createElement("h3");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.appendChild(item);
  });
}

// Fetch users when the button is clicked.
loadUsersButton.addEventListener("click", loadUsers);

// Filter the stored array without making another API request.
filterInput.addEventListener("input", () => {
  const searchTerm = filterInput.value.trim().toLowerCase();

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm)
  );

  renderUsers(filteredUsers);
});

