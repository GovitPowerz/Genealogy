const familyTree = {
  name: "Eleanor Stone",
  role: "Matriarch",
  years: "1942 – Present",
  details: "Family historian and keeper of stories.",
  children: [
    {
      name: "Michael Stone",
      role: "Son",
      years: "1968 – Present",
      details: "Married to Anita, with two children.",
      children: [
        {
          name: "Olivia Stone",
          role: "Granddaughter",
          years: "1995 – Present",
          details: "Archivist and family researcher.",
          children: [],
        },
        {
          name: "Lucas Stone",
          role: "Grandson",
          years: "1998 – Present",
          details: "Documents family reunions through photography.",
          children: [],
        },
      ],
    },
    {
      name: "Sarah Bennett",
      role: "Daughter",
      years: "1972 – Present",
      details: "Keeps the family tree updated each year.",
      children: [
        {
          name: "Noah Bennett",
          role: "Grandson",
          years: "2001 – Present",
          details: "Collects oral histories from relatives.",
          children: [],
        },
      ],
    },
  ],
};

function createPersonCard(person) {
  const article = document.createElement("article");
  article.className = "person-card";

  const title = document.createElement("h3");
  title.textContent = person.name;

  const role = document.createElement("p");
  role.className = "person-role";
  role.textContent = person.role;

  const years = document.createElement("p");
  years.className = "person-meta";
  years.textContent = person.years;

  const details = document.createElement("p");
  details.className = "person-meta";
  details.textContent = person.details;

  article.append(title, role, years, details);
  return article;
}

function createBranch(person) {
  const item = document.createElement("li");
  item.appendChild(createPersonCard(person));

  if (person.children.length > 0) {
    const list = document.createElement("ul");
    person.children.forEach((child) => {
      list.appendChild(createBranch(child));
    });
    item.appendChild(list);
  }

  return item;
}

function renderTree(rootPerson) {
  const treeRoot = document.getElementById("tree-root");
  if (!treeRoot) {
    return;
  }

  const tree = document.createElement("ul");
  tree.className = "tree";
  tree.appendChild(createBranch(rootPerson));
  treeRoot.replaceChildren(tree);
}

renderTree(familyTree);
