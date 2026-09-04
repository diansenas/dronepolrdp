const express = require("express");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// Banco de dados SQLite
const db = new Database("dronepol.db");
const sessoes = new Map();

const servidores = [
  ["", "", "6464203", "RICHARD SOARES MARIANO", "RICHARD"],
  ["", "", "6488463", "ANGELO LACATIVA", "LACATIVA"],
  ["SUBINSPETOR", "2832", "6486061", "ALEXANDRE MENDES", "MENDES"],
  ["SUBINSPETOR", "5737", "6746578", "FLAVIO GOMES DA SILVA", "FLAVIO"],
  ["SUBINSPETOR", "4599", "6807526", "RITA DE CASSIA GOMES HELENO", "RITA"],
  ["SUBINSPETOR", "5952", "6961169", "VINICIUS LIMA FONSECA", "VINICIUS"],
  ["SUBINSPETOR", "6275", "7088175", "EIDE JESUS NOGUEIRA", "EIDE"],
  ["CE", "8267", "7563345", "PAULO SERGIO LINO DOS SANTOS", "LINO"],
  ["CE", "8715", "7722524", "PAULO ROBERTO OLIVEIRA MENDES", "MENDES"],
  ["CE", "9257", "8156701", "ANSELMO DOS SANTOS FERNANDES", "ANSELMO"],
  ["CE", "9215", "8159025", "LEONARDO SILVA BRITO", "BRITO"],
  ["CE", "9764", "8480036", "DAVID SANTOS RUIZ", "RUIZ"],
  ["CE", "9734", "8487316", "WELLINGTON DOS SANTOS DE SOUZA", "WELLINGTON"],
  ["GCM 2ª", "10327", "9166335", "GLAUCE REBERTE DA SILVA", "REBERTE"],
  ["GCM 2ª", "10492", "9168150", "VITOR OLIVEIRA MARINHO", "MARINHO"],
  ["GCM 2ª", "10784", "9171398", "GABRIEL ALEXANDRO DE MENEZES COELHO", "COELHO"],
  ["GCM 2ª", "11070", "9174508", "ANTONIO CESAR ABASCAL INFANTES CAMARA", "INFANTES"],
  ["GCM 2ª", "11170", "9175610", "RENATA VRECH", "RENATA"],
  ["GCM 3ª", "11330", "9275037", "YURI ODILON DIAS DA SILVA", "ODILON"],
  ["GCM 3ª", "11667", "9276688", "VICTOR ROBAINA DE AZEVEDO", "ROBAINA"],
  ["GCM 3ª", "11347", "9303600", "DIAN SENAS VIEIRA", "DIAN"],
  ["GCM 3ª", "11997", "9421262", "KAMILA FREIRES DE OLIVEIRA MENDES", "KAMILA MENDES"]
];

function criarSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function conferirSenha(senha, armazenada) {
  const [salt, hash] = armazenada.split(":");
  const atual = crypto.scryptSync(senha, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(atual, "hex"));
}

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

  CREATE TABLE IF NOT EXISTS historico_baterias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bateria_id INTEGER NOT NULL,
    acao TEXT NOT NULL,
    operador TEXT NOT NULL,
    detalhes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS servidores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graduacao TEXT NOT NULL DEFAULT '',
    distintivo TEXT NOT NULL DEFAULT '',
    rf TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    nome_guerra TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    deve_trocar_senha INTEGER NOT NULL DEFAULT 1,
    ativo INTEGER NOT NULL DEFAULT 1
  );
`);

const inserirServidor = db.prepare(`
  INSERT OR IGNORE INTO servidores
    (graduacao, distintivo, rf, nome, nome_guerra, senha_hash)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const servidor of servidores) {
  inserirServidor.run(...servidor.slice(0, 5), criarSenha("0000"));
}

const colunasHistorico = db
  .prepare("PRAGMA table_info(historico_baterias)")
  .all();

if (!colunasHistorico.some(coluna => coluna.name === "observacao")) {
  db.exec(
    "ALTER TABLE historico_baterias ADD COLUMN observacao TEXT NOT NULL DEFAULT ''"
  );
}

function registrarHistorico(
  bateriaId,
  acao,
  operador,
  detalhes = "",
  observacao = ""
) {
  db.prepare(`
    INSERT INTO historico_baterias
      (bateria_id, acao, operador, detalhes, observacao)
    VALUES (?, ?, ?, ?, ?)
  `).run(bateriaId, acao, operador, detalhes, observacao);
}

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

function usuarioDaRequisicao(req) {
  const token = req.headers.cookie
    ?.split(";")
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith("dronepol_sessao="))
    ?.split("=")[1];

  const sessao = token && sessoes.get(token);

  if (!sessao || sessao.expiraEm < Date.now()) {
    return null;
  }

  return db
    .prepare(`
      SELECT id, graduacao, distintivo, rf, nome, nome_guerra, deve_trocar_senha
      FROM servidores
      WHERE id = ? AND ativo = 1
    `)
    .get(sessao.servidorId);
}

function nomeParaHistorico(usuario) {
  return `${usuario.graduacao || ""} ${usuario.nome_guerra} | ${usuario.nome} | RF ${usuario.rf}`
    .replace(/\s+/g, " ")
    .trim();
}

app.post("/api/auth/login", (req, res) => {
  const rf = String(req.body.rf || "").trim();
  const senha = String(req.body.senha || "");

  if (!/^\d{7}$/.test(rf) || !/^\d{4}$/.test(senha)) {
    return res.status(400).json({
      error: "Informe um RF e uma senha com 4 dígitos."
    });
  }

  const servidor = db
    .prepare("SELECT * FROM servidores WHERE rf = ? AND ativo = 1")
    .get(rf);

  if (!servidor || !conferirSenha(senha, servidor.senha_hash)) {
    return res.status(401).json({
      error: "RF ou senha inválidos."
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessoes.set(token, {
    servidorId: servidor.id,
    expiraEm: Date.now() + 8 * 60 * 60 * 1000
  });

  res.setHeader(
    "Set-Cookie",
    `dronepol_sessao=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`
  );

  res.json({
    graduacao: servidor.graduacao,
    distintivo: servidor.distintivo,
    rf: servidor.rf,
    nome: servidor.nome,
    nome_guerra: servidor.nome_guerra,
    deve_trocar_senha: Boolean(servidor.deve_trocar_senha)
  });
});

app.get("/api/auth/me", (req, res) => {
  const usuario = usuarioDaRequisicao(req);

  if (!usuario) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  res.json({
    ...usuario,
    deve_trocar_senha: Boolean(usuario.deve_trocar_senha)
  });
});

app.post("/api/auth/trocar-senha", (req, res) => {
  const usuario = usuarioDaRequisicao(req);
  const senha = String(req.body.senha || "");

  if (!usuario) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  if (!/^\d{4}$/.test(senha)) {
    return res.status(400).json({
      error: "A senha deve ter exatamente 4 dígitos."
    });
  }

  db.prepare(`
    UPDATE servidores
    SET senha_hash = ?, deve_trocar_senha = 0
    WHERE id = ?
  `).run(criarSenha(senha), usuario.id);

  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (req.path === "/login.html" || req.path === "/api/auth/login") {
    return next();
  }

  const usuario = usuarioDaRequisicao(req);

  if (!usuario) {
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Faça login para continuar." });
    }

    return res.redirect("/login.html");
  }

  if (
    usuario.deve_trocar_senha &&
    req.path !== "/login.html" &&
    req.path !== "/api/auth/me" &&
    req.path !== "/api/auth/trocar-senha"
  ) {
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({
        error: "Troque a senha provisória para continuar."
      });
    }

    return res.redirect("/login.html?trocar=1");
  }

  req.usuario = usuario;
  next();
});

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

app.get("/api/baterias/id/:id", (req, res) => {
  const id = Number(req.params.id);

  const bateria = db
    .prepare("SELECT * FROM baterias WHERE id = ?")
    .get(id);

  if (!bateria) {
    return res.status(404).json({
      error: "Bateria não encontrada."
    });
  }

  res.json(bateria);
});

// ============================================
// CONSULTAR HISTÓRICO DA BATERIA
// ============================================

app.get("/api/baterias/:id/historico", (req, res) => {
  const id = Number(req.params.id);

  const historico = db
    .prepare(`
      SELECT id, bateria_id, acao, operador, detalhes, observacao, created_at
      FROM historico_baterias
      WHERE bateria_id = ?
      ORDER BY id DESC
    `)
    .all(id);

  res.json(historico);
});

app.get("/api/historico/:id", (req, res) => {
  const id = Number(req.params.id);

  const registro = db
    .prepare(`
      SELECT historico_baterias.*, baterias.numero_serie
      FROM historico_baterias
      LEFT JOIN baterias ON baterias.id = historico_baterias.bateria_id
      WHERE historico_baterias.id = ?
    `)
    .get(id);

  if (!registro) {
    return res.status(404).json({
      error: "Registro do histórico não encontrado."
    });
  }

  res.json(registro);
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
    ,
    operador = ""
  } = req.body;

  const serie = String(numero_serie || "")
    .trim()
    .toUpperCase();

  if (!serie) {
    return res.status(400).json({
      error: "Número de série é obrigatório."
    });
  }

  const nomeOperador = nomeParaHistorico(req.usuario);

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

    registrarHistorico(
      bateria.id,
      "Cadastro",
      nomeOperador,
      "Bateria cadastrada",
      observacoes
    );

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
    ,
    operador = ""
  } = req.body;

  const nomeOperador = nomeParaHistorico(req.usuario);

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

  registrarHistorico(
    bateria.id,
    "Edição",
    nomeOperador,
    "Dados da bateria atualizados",
    observacoes
  );

  res.json(bateria);
});

// ============================================
// EXCLUIR BATERIA
// ============================================

app.delete("/api/baterias/:id", (req, res) => {
  const id = Number(req.params.id);
  const nomeOperador = nomeParaHistorico(req.usuario);

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

  registrarHistorico(
    id,
    "Exclusão",
    nomeOperador,
    "Bateria excluída"
  );

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