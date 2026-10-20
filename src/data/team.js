/* Equipe — TCC Andrômeda.
 *
 * COMO PREENCHER
 *
 * 1. Fotos
 *    Coloque os arquivos em `src/assets/team/` (ex: `vinicius.jpg`), importe no topo
 *    deste arquivo e use a variável no campo `photo`:
 *
 *        import viniciusPhoto from "../assets/team/vinicius.jpg";
 *        // ...
 *        photo: viniciusPhoto,
 *
 *    Com `photo: null`, o card usa um avatar de iniciais — é um estado de design
 *    intencional, não um placeholder quebrado. Formato ideal: quadrado (1:1),
 *    pelo menos 400×400px.
 *
 * 2. Links
 *    Preencha só o que existir de fato. Chave vazia, `null` ou string em branco
 *    simplesmente não é renderizada — nunca use `href="#"` como placeholder.
 *    Ordem de exibição fixa: LinkedIn → GitHub → Instagram → E-mail.
 *
 *        linkedin:  "https://www.linkedin.com/in/usuario/"
 *        github:    "https://github.com/usuario"
 *        instagram: "https://www.instagram.com/usuario/"
 *        email:     "nome@dominio.com"        // "mailto:" é opcional, adicionado sozinho
 *
 * 3. Papéis
 *    `role` traz a profissão de cada um (não o papel no TCC — os três são autores,
 *    o que já é dito no texto da seção "Quem faz" em HomeScreen.jsx).
 */

import viniciusPhoto from "../assets/team/vinicius.jpg";
import pedroPhoto from "../assets/team/pedro.jpg";
import nataliaPhoto from "../assets/team/natalia.jpg";

const TEAM = [
  {
    id: "vinicius",
    name: "Vinícius Veiga Rodrigues",
    role: "Dev. Fullstack Pleno",
    photo: viniciusPhoto,
    links: {
      linkedin: "https://www.linkedin.com/in/vinicius-veiga-rodrigues/",
      github: "https://github.com/ViniciusVRodrigues",
      instagram: "https://www.instagram.com/viniciusv.r/?hl=pt-br",
      email: "vinicius7107@gmail.com",
    },
  },
  {
    id: "pedro",
    name: "Pedro Henrique Silva Cabral",
    role: "Estudante de Eng. de Software",
    photo: pedroPhoto,
    links: {
      linkedin: "https://www.linkedin.com/in/phsilvacabral/",
      github: "https://github.com/phsilvacabral",
      instagram: "https://www.instagram.com/phsilvacabral/",
      email: "phsilvacabral@gmail.com",
    },
  },
  {
    id: "natalia",
    name: "Natália Molini Buffa",
    role: "Eng. de Software Júnior",
    photo: nataliaPhoto,
    links: {
      linkedin: "",
      github: "",
      instagram: "",
      email: "",
    },
  },
];

export { TEAM };
