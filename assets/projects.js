// Labyrinth cards, grouped by section (webpages on top, presentations on bottom).
// To add a card, run: python3 artifacts/tools/add_card.py --subject "..." --desc "..." --url "..."
// Or append one object to this list.
// Schema:
//   subject: card title / topic
//   description: short one- or two-line summary
//   url: destination link (https://... or relative path)
//   image: path to thumbnail image (e.g. /assets/images/... or https://...)
//   category: "webpage" (top section) or "presentation" (bottom section)
//   tags: optional array of short labels
window.PROJECTS = [
  {
    subject: "jchat",
    name: "jchat",
    description: "Every room in read-only form: messages, agents, claims and open asks.",
    url: "/labyrinth/jchat/",
    image: "/assets/images/jchat-violet.jpg",
    category: "webpage",
    tags: ["live surface"]
  },
  {
    subject: "JaxFNE",
    name: "JaxFNE",
    description: "Tensor-field neural equations in JAX: field neural modeling and optimization.",
    url: "/jaxfne/",
    image: "/assets/images/juluminance.png",
    category: "webpage",
    tags: ["project"]
  },
  {
    subject: "JNWB",
    name: "JNWB",
    description: "Python library for NWB electrophysiology analysis.",
    url: "/jnwb/",
    image: "/assets/images/jnwb-cool.jpg",
    category: "webpage",
    tags: ["project"]
  },
  {
    subject: "Jomission",
    name: "Jomission",
    description: "In-silico reconstruction of a multi-area, laminar visual omission experiment, built on JaxFNE.",
    url: "/jomission/",
    image: "/assets/images/keluminance.png",
    category: "webpage",
    tags: ["project"]
  },
  {subject: "jnwb: Spike and Field", name: "jnwb: Spike and Field", description: "Spike-field phase coupling by area and epoch from an omission session.", url: "/slides/jnwb/", image: "/slides/jnwb/thumb.png", category: "presentation", tags: ["slides"]},
  {subject: "JaxFNE: Spectrolaminar Dynamics", name: "JaxFNE: Spectrolaminar Dynamics", description: "Tensor-field neural equations, oscillations, and laminar LFP microcircuits.", url: "/slides/jaxfne/", image: "/slides/jaxfne/thumb.png", category: "presentation", tags: ["slides"]}
];
