# 🚁 DronePol - Controle de Baterias

## FASE 1 — MVP

Sistema inicial para controle de baterias de drones através da leitura do QR Code.

## Funcionamento

QR Code da bateria

↓

Número de série

↓

Banco de dados

↓

Ficha da bateria

## Exemplo

QR Code:

7PAPN9TCA0001R

O sistema identifica automaticamente esse número e procura a bateria no banco de dados.

## Funcionalidades

- Leitura de QR Code
- Cadastro de baterias
- Consulta por número de série
- Edição
- Exclusão
- Pesquisa
- Banco SQLite

## Tecnologias

- Node.js
- Express
- SQLite
- HTML
- CSS
- JavaScript
- HTML5 QR Code

## Instalação

Instalar as dependências:

npm install

Iniciar o sistema:

npm start

Abrir:

http://localhost:3000

## Banco de dados

O banco SQLite é criado automaticamente como:

dronepol.db

Na primeira execução o sistema cria uma bateria de teste:

7PAPN9TCA0001R

Modelo:

DJI TB65