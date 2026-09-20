// Catalogue AElen Paris — données produits
//
// PRIX : valeurs provisoires (en euros) à corriger avant mise en ligne
// réelle — voir le message de livraison pour la liste à vérifier.
const PRODUCTS = [
  {
    id: "trench-chocolat",
    name: "Trench Chocolat",
    category: "Manteaux",
    color: "Chocolat",
    price: 290,
    sizes: ["S", "M", "L"],
    description:
      "Trench long croisé en coton, col cranté et ceinture à nouer. Une pièce intemporelle façon boulevard parisien, portée ici sur une tenue total look noir.",
    details: [
      "Coupe longue, croisée, double boutonnage",
      "Col cranté classique",
      "Ceinture ajustable à la taille",
      "Coton résistant, doublure satinée",
    ],
    images: [
      "assets/img/fitting-tryons/trench-chocolat-m.webp",
      { src: "assets/img/products/trench-chocolat-front.png", fit: "contain" },
      { src: "assets/img/products/trench-chocolat-back.png", fit: "contain" },
    ],
  },
  {
    id: "trench-beige",
    name: "Trench Camel",
    category: "Manteaux",
    color: "Camel",
    price: 290,
    sizes: ["S", "M", "L"],
    description:
      "Trench long camel, coupe classique croisée, épaulettes structurées et manches à patte boutonnée. L'essentiel parisien à porter en toute saison.",
    details: [
      "Coupe longue, croisée, double boutonnage",
      "Épaulettes structurées",
      "Manches à patte réglable",
      "Coton gabardine",
    ],
    images: [
      "assets/img/fitting-tryons/trench-beige-m.webp",
      { src: "assets/img/products/trench-beige-front.png", fit: "contain" },
      { src: "assets/img/products/trench-beige-back.png", fit: "contain" },
    ],
  },
  {
    id: "veste-croco-beige",
    name: "Veste Courte — Col Croco",
    category: "Vestes",
    color: "Beige doré",
    price: 190,
    sizes: ["S", "M", "L"],
    description:
      "Version beige de notre veste courte signature, avec col et poignets en effet croco doré. Un contraste de matières pensé pour sublimer une tenue simple.",
    details: [
      "Coupe courte, cintrée à l'ourlet élastiqué",
      "Col et poignets effet croco doré",
      "Poches passepoilées",
      "Doublure interne soignée",
    ],
    images: [
      { src: "assets/img/fitting-tryons/veste-croco-beige-m.webp", fit: "cover" },
      "assets/img/products/veste-croco-beige-01.png",
      "assets/img/products/veste-croco-beige-back.png",
    ],
    fit: "contain",
  },
  {
    id: "cardigan-bordeaux",
    name: "Cardigan Bordeaux",
    category: "Mailles",
    color: "Bordeaux",
    price: 140,
    sizes: ["S", "M", "L"],
    description:
      "Cardigan en grosse maille bordeaux, col montant boutonné et boutonnage asymétrique. Épaulettes à bouton pour une touche utilitaire chic.",
    details: [
      "Maille épaisse et chaude",
      "Col montant boutonné",
      "Boutonnage asymétrique",
      "Épaulettes à bouton, manches à revers",
    ],
    images: [
      { src: "assets/img/fitting-tryons/cardigan-bordeaux-m.webp", fit: "cover" },
      "assets/img/products/cardigan-bordeaux-01.png",
      "assets/img/products/cardigan-bordeaux-back.png",
    ],
    fit: "contain",
  },
  {
    id: "veste-foulard-marron",
    name: "Veste Courte — Col Foulard Écossais",
    category: "Vestes",
    color: "Marron",
    price: 210,
    sizes: ["S", "M", "L"],
    description:
      "Veste courte en coton marron, large col cape doublé d'un tartan bleu et brun, à nouer en foulard sur le devant. Poignets et poche à rabat assortis au tartan.",
    details: [
      "Coupe courte, boutonnage simple",
      "Large col cape à nouer façon foulard",
      "Doublure et parements en tartan bleu et brun",
      "Poche à rabat, poignets boutonnés assortis",
    ],
    images: [
      "assets/img/fitting-tryons/veste-foulard-marron-m.webp",
      { src: "assets/img/products/veste-foulard-marron-front.png", fit: "contain" },
      { src: "assets/img/products/veste-foulard-marron-back.png", fit: "contain" },
    ],
  },
  {
    id: "pull-raye-beige",
    name: "Pull Col Polo Rayé Beige",
    category: "Mailles",
    color: "Beige",
    price: 130,
    sizes: ["S", "M", "L"],
    description:
      "Pull en maille épaisse à rayures beige et brun, col polo boutonné et cordon de resserre à l'ourlet. Une pièce chaude et décontractée pour l'entre-saison.",
    details: [
      "Maille épaisse et chaude",
      "Col polo, boutonnage haut",
      "Ourlet resserré par cordon",
      "Coupe courte, manches amples",
    ],
    images: [
      "assets/img/fitting-tryons/pull-raye-beige-m.webp",
      { src: "assets/img/products/pull-raye-beige-front.png", fit: "contain" },
    ],
  },
  {
    id: "pull-raye-rouge",
    name: "Pull Col Polo Rayé Rouge",
    category: "Mailles",
    color: "Rouge",
    price: 130,
    sizes: ["S", "M", "L"],
    description:
      "Version rouge et gris chiné de notre pull rayé signature, col polo boutonné et cordon de resserre à l'ourlet. Un contraste vif pour twister une tenue simple.",
    details: [
      "Maille épaisse et chaude",
      "Col polo, boutonnage haut",
      "Ourlet resserré par cordon",
      "Coupe courte, manches amples",
    ],
    images: [
      "assets/img/fitting-tryons/pull-raye-rouge-m.webp",
      { src: "assets/img/products/pull-raye-rouge-front.png", fit: "contain" },
    ],
  },
];

// Permet aussi à ce fichier d'être chargé côté serveur (fonction API
// Vercel) via require(), pour valider les prix sans faire confiance
// au panier envoyé par le navigateur. Sans effet dans le navigateur,
// où `module` n'existe pas.
if (typeof module !== "undefined") {
  module.exports = PRODUCTS;
}
