<p align="center">
  <img alt="Repository size" src="https://img.shields.io/github/repo-size/JonathanFerraz/react-mouse-smooth">
  <a href="https://github.com/JonathanFerraz/react-mouse-smooth/commits/master">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/JonathanFerraz/react-mouse-smooth">
  </a>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-brightgreen">
  <a href="https://github.com/JonathanFerraz">
    <img alt="Feito por Jonathan Ferraz" src="https://img.shields.io/badge/feito%20por-Jonathan-Ferraz%237519C1">
  </a>
</p>
<br>
<h1 align="center">
   React Mouse Smooth
</h1>
<p align="center"> 
 Add smooth scrolling to your react project 
</p>

## Install

```bash
# npm
  npm i react-mouse-smooth

# yarn
  yarn add react-mouse-smooth
```

## Usage

Import MouseSmooth in your App.js

```js
// import
import { MouseSmooth } from 'react-mouse-smooth';

// const
const { SmoothScroll } = require('react-mouse-smooth');
```

Example

```js
import React from 'react';

import { SmoothScroll } from 'react-mouse-smooth';

function App() {
  SmoothScroll({});

  return ()
}

export default App;
```

Options:

- `time: number` tempo entre a rolagem suave
- `size: number` o tamanho de pixel a cada rolagem
- `keyboardSupport: boolean` definir se deve aplicar o efeito ao usar o teclado

<br>
<p align="center">
  Made with &nbsp💜&nbsp by Jonathan Ferraz
</p>
