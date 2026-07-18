window.CHIQUI_CONFIG = {
  regularSeasonRounds: 15,
  adminPin: '2026',
  // Pegá aquí la URL de una Web App de Google Apps Script para compartir
  // solicitudes y aprobaciones entre distintos celulares.
  goalsApiUrl: 'https://script.google.com/macros/s/AKfycbyMsl49gADfu7oxnJXbAtI47LjjMSfVx0ffSrooWmbawqtSRMHRoBkOIDrhfyOgp55WIQ/exec',
  sources: [
    { gid: '1656137437', fallback: 'data/1656137437.csv' },
    { gid: '871809491', fallback: 'data/871809491.csv' },
    { gid: '868657404', fallback: 'data/868657404.csv' },
    { gid: '432034466', fallback: 'data/432034466.csv' },
    { gid: '376531473', fallback: 'data/376531473.csv' },
    { gid: '990740373', fallback: 'data/990740373.csv' },
    { gid: '1519685756', fallback: 'data/1519685756.csv' }
  ],
  sheetBase: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRLr8HYdpSgizF-UkjdCAGQE7mhaZm4uax03QHVycBJ0pld5xd4Hir6Q8T-2sbZsw_6iI2emuwY-sMM/pub?single=true&output=csv&gid='
};
