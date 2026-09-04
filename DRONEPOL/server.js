const express = require("express");
const path = require("path");
const os = require("os");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// Banco de dados SQLite
const db = new Database("dronepol.db");

db.pragma("journal_mode = WAL");

// Criar tabela de baterias
db.exec(`
  CREATE TABLE IF NOT EXISTS baterias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_serie TEXT NOT NULL UNIQUE,
    modelo TEXT NOT NULL DEFAULT 'DJI TB65',
    ciclos INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Disponível',
    drone TEXT DEFAULT '',
    inspetoria TEXT DEFAULT '',
    observacoes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Inserir bateria de teste na primeira execução
const quantidade = db
  .prepare("SELECT COUNT(*) AS total FROM baterias")
  .get();

if (quantidade.total === 0) {
  db.prepare(`
    INSERT INTO baterias
      (
        numero_serie,
        modelo,
        ciclos,
        status,
        drone,
        inspetoria,
        observacoes
      )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "7PAPN9TCA0001R",
    "DJI TB65",
    0,
    "Disponível",
    "",
    "",
    "Bateria utilizada como registro de teste do MVP."
  );
}

// Permitir JSON
app.use(express.json());

// Arquivos do site
app.use(express.static(path.join(__dirname, "public")));

// ============================================
// LISTAR TODAS AS BATERIAS
// ============================================

app.get("/api/baterias", (req, res) => {
  const baterias = db
    .prepare(`
      SELECT *
      FROM baterias
      ORDER BY id DESC
    `)
    .all();

  res.json(baterias);
});

// ============================================
// CONSULTAR BATERIA PELO NÚMERO DE SÉRIE
// ============================================

app.get("/api/baterias/:serie", (req, res) => {
  const serie = req.params.serie.trim().toUpperCase();

  const bateria = db
    .prepare(`
      SELECT *
      FROM baterias
      WHERE numero_serie = ?
    `)
    .get(serie);

  if (!bateria) {
    return res.status(404).json({
      error: "Bateria não cadastrada."
    });
  }

  res.json(bateria);
});

// ============================================
// CADASTRAR BATERIA
// ============================================

app.post("/api/baterias", (req, res) => {
  const {
    numero_serie,
    modelo = "DJI TB65",
    ciclos = 0,
    status = "Disponível",
    drone = "",
    inspetoria = "",
    observacoes = ""
  } = req.body;

  const serie = String(numero_serie || "")
    .trim()
    .toUpperCase();

  if (!serie) {
    return res.status(400).json({
      error: "Número de série é obrigatório."
    });
  }

  try {
    const resultado = db
      .prepare(`
        INSERT INTO baterias
          (
            numero_serie,
            modelo,
            ciclos,
            status,
            drone,
            inspetoria,
            observacoes
          )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        serie,
        modelo,
        Number(ciclos) || 0,
        status,
        drone,
        inspetoria,
        observacoes
      );

    const bateria = db
      .prepare(`
        SELECT *
        FROM baterias
        WHERE id = ?
      `)
      .get(resultado.lastInsertRowid);

    res.status(201).json(bateria);

  } catch (erro) {

    if (String(erro.message).includes("UNIQUE")) {
      return res.status(409).json({
        error: "Esse número de série já está cadastrado."
      });
    }

    res.status(500).json({
      error: "Erro ao cadastrar bateria."
    });
  }
});

// ============================================
// EDITAR BATERIA
// ============================================

app.put("/api/baterias/:id", (req, res) => {
  const id = Number(req.params.id);

  const {
    modelo = "DJI TB65",
    ciclos = 0,
    status = "Disponível",
    drone = "",
    inspetoria = "",
    observacoes = ""
  } = req.body;

  const resultado = db
    .prepare(`
      UPDATE baterias
      SET
        modelo = ?,
        ciclos = ?,
        status = ?,
        drone = ?,
        inspetoria = ?,
        observacoes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .run(
      modelo,
      Number(ciclos) || 0,
      status,
      drone,
      inspetoria,
      observacoes,
      id
    );

  if (!resultado.changes) {
    return res.status(404).json({
      error: "Bateria não encontrada."
    });
  }

  const bateria = db
    .prepare(`
      SELECT *
      FROM baterias
      WHERE id = ?
    `)
    .get(id);

  res.json(bateria);
});

// ============================================
// EXCLUIR BATERIA
// ============================================

app.delete("/api/baterias/:id", (req, res) => {
  const id = Number(req.params.id);

  const resultado = db
    .prepare(`
      DELETE FROM baterias
      WHERE id = ?
    `)
    .run(id);

  if (!resultado.changes) {
    return res.status(404).json({
      error: "Bateria não encontrada."
    });
  }

  res.json({
    ok: true
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, "0.0.0.0", () => {
  const interfaces = os.networkInterfaces();
  const addresses = Object.values(interfaces)
    .flat()
    .filter(address => address && address.family === "IPv4" && !address.internal)
    .map(address => `http://${address.address}:${PORT}`);

  console.log(`
========================================
   DRONEPOL - CONTROLE DE BATERIAS
========================================

Servidor rodando em:

http://localhost:${PORT}

${addresses.length ? `Acesso pela rede:\n${addresses.join("\n")}` : ""}

========================================
  `);
});