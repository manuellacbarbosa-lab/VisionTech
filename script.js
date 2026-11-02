
/* =====================================
   BANCO DE DADOS LOCAL - INDEXEDDB
===================================== */

const BANCO = "VisionTechDB";
const ARMAZENAMENTO = "produtos";

function abrirBanco() {
    return new Promise((resolve, reject) => {
        const requisicao = indexedDB.open(BANCO, 2);

        requisicao.onupgradeneeded = function(event) {

            const banco = event.target.result;
        
            // TABELA DE PRODUTOS
            if (!banco.objectStoreNames.contains("produtos")) {
        
                banco.createObjectStore("produtos", {
                    keyPath: "id",
                    autoIncrement: true
                });
        
            }
        
            // TABELA DE RECEITAS
            if (!banco.objectStoreNames.contains("receitas")) {
        
                banco.createObjectStore("receitas", {
                    keyPath: "id",
                    autoIncrement: true
                });
        
            }
        
        };

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
    });
}

async function salvarNoBanco(produto) {
    const banco = await abrirBanco();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction(ARMAZENAMENTO, "readwrite");
        const requisicao = transacao.objectStore(ARMAZENAMENTO).add(produto);

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);

        transacao.oncomplete = () => banco.close();
        transacao.onerror = () => reject(transacao.error);
    });
}

async function buscarNoBanco() {
    const banco = await abrirBanco();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction(ARMAZENAMENTO, "readonly");
        const requisicao = transacao.objectStore(ARMAZENAMENTO).getAll();

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);

        transacao.oncomplete = () => banco.close();
    });
}


/* =====================================
   ELEMENTOS DO PAINEL
===================================== */

const formularioProduto = document.getElementById("produtoForm");
const listaProdutos = document.getElementById("listaProdutos");
const listaAlertas = document.getElementById("listaAlertas");

let produtos = [];
let filtroAtual = "todos";

const nomeUsuario = localStorage.getItem("visiontechNome");

const saudacao = document.getElementById("saudacao");

if (saudacao && nomeUsuario) {
    saudacao.textContent = `Olá, ${nomeUsuario}!`;
}


/* =====================================
   CÁLCULO DA VALIDADE
===================================== */

function calcularDias(validade) {
    const [ano, mes, dia] = validade.split("-").map(Number);

    const dataValidade = Date.UTC(ano, mes - 1, dia);

    const hoje = new Date();

    const hojeUTC = Date.UTC(
        hoje.getFullYear(),
        hoje.getMonth(),
        hoje.getDate()
    );

    return Math.round((dataValidade - hojeUTC) / 86400000);
}

function obterSituacao(validade) {
    const dias = calcularDias(validade);

    if (dias < 0) return "vencidos";
    if (dias <= 7) return "breve";
    if (dias <= 30) return "atencao";

    return "emdia";
}

function formatarData(data) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
}


/* =====================================
   CADASTRO DE PRODUTOS
===================================== */

if (formularioProduto) {
    formularioProduto.addEventListener("submit", async function(event) {
        event.preventDefault();

        const arquivo = document.getElementById("foto").files[0];

        if (arquivo && !arquivo.type.startsWith("image/")) {
            alert("Selecione um arquivo de imagem válido.");
            return;
        }

        if (arquivo && arquivo.size > 4 * 1024 * 1024) {
            alert("A imagem deve ter no máximo 4 MB.");
            return;
        }

        const qualidade = Array.from(
            document.querySelectorAll('input[name="qualidade"]:checked')
        ).map(item => item.value);

        const produto = {
            nome: document.getElementById("nomeProduto").value.trim(),
            lote: document.getElementById("lote").value.trim(),
            categoria: document.getElementById("categoria").value.trim(),
            quantidade: Number(document.getElementById("quantidade").value),
            validade: document.getElementById("validade").value,
            qualidade: qualidade,
            foto: null,
            dataCadastro: new Date().toISOString()
        };

        if (!produto.nome || !produto.lote ||
            !produto.categoria || !produto.validade ||
            !Number.isFinite(produto.quantidade) ||
            produto.quantidade < 1) {
            alert("Preencha corretamente todos os campos.");
            return;
        }

        if (arquivo) {
            try {
                produto.foto = await lerImagem(arquivo);
            } catch (erro) {
                alert("Não foi possível carregar a imagem.");
                return;
            }
        }

        try {
            await salvarNoBanco(produto);

            alert("Produto cadastrado com sucesso!");

            formularioProduto.reset();

            await atualizarPainel();

        } catch (erro) {
            console.error(erro);
            alert("Não foi possível salvar o produto. Verifique o espaço disponível no navegador.");
        }
    });
}


/* =====================================
   LEITURA DA IMAGEM
===================================== */

function lerImagem(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();

        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(leitor.error);

        leitor.readAsDataURL(arquivo);
    });
}


/* =====================================
   ATUALIZAR INDICADORES
===================================== */

function atualizarIndicadores() {
    const total = produtos.length;

    const vencendo = produtos.filter(produto =>
        obterSituacao(produto.validade) === "breve"
    ).length;

    const vencidos = produtos.filter(produto =>
        obterSituacao(produto.validade) === "vencidos"
    ).length;

    const pendentes = produtos.filter(produto =>
        produto.qualidade.length < 5
    ).length;

    document.getElementById("totalProdutos").textContent = total;
    document.getElementById("produtosVencendo").textContent = vencendo;
    document.getElementById("produtosVencidos").textContent = vencidos;
    document.getElementById("verificacoesPendentes").textContent = pendentes;
}


/* =====================================
   MOSTRAR ALERTAS
===================================== */

function atualizarAlertas() {
    const alertas = produtos.filter(produto => {
        const situacao = obterSituacao(produto.validade);

        return situacao === "breve" || situacao === "vencidos";
    });

    if (alertas.length === 0) {
        listaAlertas.innerHTML = `
            <p class="mensagem-vazia">
                Nenhum produto vencido ou próximo do vencimento.
            </p>
        `;
        return;
    }

    listaAlertas.innerHTML = alertas.map(produto => {
        const dias = calcularDias(produto.validade);

        let mensagem = dias < 0
            ? `Vencido há ${Math.abs(dias)} dia(s)`
            : dias === 0
                ? "Vence hoje"
                : `Vence em ${dias} dia(s)`;

        return `
            <div class="alerta-item">
                <strong>${escaparHTML(produto.nome)}</strong>
                <span>${mensagem}</span>
                <small>Validade: ${formatarData(produto.validade)}</small>
            </div>
        `;
    }).join("");
}


/* =====================================
   MOSTRAR PRODUTOS
===================================== */

function escaparHTML(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function atualizarLista() {
    const busca = document.getElementById("buscaProduto")
        .value.trim().toLowerCase();

    const filtrados = produtos.filter(produto => {
        const correspondeBusca =
            produto.nome.toLowerCase().includes(busca) ||
            produto.categoria.toLowerCase().includes(busca) ||
            produto.lote.toLowerCase().includes(busca);

        const situacao = obterSituacao(produto.validade);

        const correspondeFiltro =
            filtroAtual === "todos" ||
            filtroAtual === situacao;

        return correspondeBusca && correspondeFiltro;
    });

    if (filtrados.length === 0) {
        listaProdutos.innerHTML = `
            <p class="mensagem-vazia">
                Nenhum produto encontrado.
            </p>
        `;
        return;
    }

    listaProdutos.innerHTML = filtrados.map(produto => {
        const situacao = obterSituacao(produto.validade);

        const nomesSituacao = {
            breve: "Vence em breve",
            atencao: "Atenção",
            emdia: "Em dia",
            vencidos: "Vencido"
        };

        const imagem = produto.foto
            ? `<img src="${produto.foto}" alt="Foto de ${escaparHTML(produto.nome)}">`
            : `<div class="sem-foto">Sem foto</div>`;

        return `
            <article class="produto-card">
                ${imagem}

                <div class="produto-info">
                    <h3>${escaparHTML(produto.nome)}</h3>

                    <p>Categoria: ${escaparHTML(produto.categoria)}</p>
                    <p>Lote: ${escaparHTML(produto.lote)}</p>
                    <p>Quantidade: ${produto.quantidade}</p>
                    <p>Validade: ${formatarData(produto.validade)}</p>

                    <span class="status status-${situacao}">
                        ${nomesSituacao[situacao]}
                    </span>

                    <p>Checklist: ${produto.qualidade.length}/5 itens verificados</p>
                </div>
            </article>
        `;
    }).join("");
}


/* =====================================
   PESQUISA E FILTROS
===================================== */

const campoBusca = document.getElementById("buscaProduto");

if (campoBusca) {
    campoBusca.addEventListener("input", atualizarLista);
}

document.querySelectorAll(".filtros button").forEach(botao => {
    botao.addEventListener("click", function() {
        filtroAtual = this.dataset.filtro;

        document.querySelectorAll(".filtros button").forEach(item => {
            item.classList.remove("ativo");
        });

        this.classList.add("ativo");

        atualizarLista();
    });
});


/* =====================================
   EXPORTAR EXCEL - CSV
===================================== */

function exportarExcel() {
    const cabecalho = [
        "Nome",
        "Lote",
        "Categoria",
        "Quantidade",
        "Validade",
        "Situacao",
        "Checklist"
    ];

    const linhas = produtos.map(produto => [
        produto.nome,
        produto.lote,
        produto.categoria,
        produto.quantidade,
        formatarData(produto.validade),
        obterSituacao(produto.validade),
        `${produto.qualidade.length}/5`
    ]);

    const csv = [cabecalho, ...linhas]
        .map(linha => linha.map(valor =>
            `"${String(valor).replace(/"/g, '""')}"`
        ).join(";"))
        .join("\r\n");

    const arquivo = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");

    link.href = url;
    link.download = "relatorio-visiontech.csv";
    link.click();

    URL.revokeObjectURL(url);
}

const botaoExcel = document.getElementById("exportarExcel");

if (botaoExcel) {
    botaoExcel.addEventListener("click", exportarExcel);
}


/* =====================================
   EXPORTAR PDF
===================================== */

function exportarPDF() {
    const janela = window.open("", "_blank");

    if (!janela) {
        alert("Permita a abertura de janelas para gerar o relatório.");
        return;
    }

    const linhas = produtos.map(produto => `
        <tr>
            <td>${escaparHTML(produto.nome)}</td>
            <td>${escaparHTML(produto.lote)}</td>
            <td>${escaparHTML(produto.categoria)}</td>
            <td>${produto.quantidade}</td>
            <td>${formatarData(produto.validade)}</td>
            <td>${obterSituacao(produto.validade)}</td>
            <td>${produto.qualidade.length}/5</td>
        </tr>
    `).join("");

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório VisionTech</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 25px;
                    color: #1f2937;
                }

                h1 {
                    color: #2563eb;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 9px;
                    text-align: left;
                    font-size: 12px;
                }

                th {
                    background: #2563eb;
                    color: white;
                }

                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <h1>VisionTech</h1>
            <h2>Relatório de produtos cadastrados</h2>
            <p>Total de produtos: ${produtos.length}</p>

            <table>
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Lote</th>
                        <th>Categoria</th>
                        <th>Quantidade</th>
                        <th>Validade</th>
                        <th>Situação</th>
                        <th>Checklist</th>
                    </tr>
                </thead>

                <tbody>
                    ${linhas || "<tr><td colspan='7'>Nenhum produto cadastrado.</td></tr>"}
                </tbody>
            </table>
        </body>
        </html>
    `);

    janela.document.close();

    janela.onload = () => janela.print();
}

const botaoPDF = document.getElementById("exportarPDF");

if (botaoPDF) {
    botaoPDF.addEventListener("click", exportarPDF);
}


/* =====================================
   ATUALIZAR TODO O PAINEL
===================================== */

async function atualizarPainel() {
    produtos = await buscarNoBanco();

    atualizarIndicadores();
    atualizarAlertas();
    atualizarLista();
}


/* =====================================
   INICIALIZAÇÃO
===================================== */

if (formularioProduto) {
    atualizarPainel().catch(erro => {
        console.error(erro);
        alert("Não foi possível carregar os produtos.");
    });
}

/* =====================================
   LOGIN E CADASTRO DE USUÁRIOS
===================================== */

// LOGIN
const formularioLogin = document.getElementById("loginForm");

if (formularioLogin) {
    formularioLogin.addEventListener("submit", function(event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value;

        if (senha.length < 6) {
            alert("A senha precisa ter pelo menos 6 caracteres!");
            return;
        }

        const emailCadastrado = localStorage.getItem("visiontechEmail");

        if (!emailCadastrado) {
            alert("Você ainda não possui cadastro. Crie sua conta primeiro!");
            return;
        }

        if (email.toLowerCase() !== emailCadastrado.toLowerCase()) {
            alert("E-mail não encontrado neste navegador.");
            return;
        }

        if (!localStorage.getItem("visiontechNome")) {
            localStorage.setItem("visiontechNome", email.split("@")[0]);
        }

        window.location.href = "painel.html";
    });
}


// CADASTRO
const formularioCadastro = document.getElementById("cadastroForm");

if (formularioCadastro) {
    formularioCadastro.addEventListener("submit", function(event) {
        event.preventDefault();

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value;
        const confirmarSenha = document.getElementById("confirmarSenha").value;

        if (!nome || !email) {
            alert("Preencha todos os campos!");
            return;
        }

        if (senha.length < 6) {
            alert("A senha precisa ter pelo menos 6 caracteres!");
            return;
        }

        if (senha !== confirmarSenha) {
            alert("As senhas não são iguais!");
            return;
        }

        localStorage.setItem("visiontechNome", nome.split(" ")[0]);
        localStorage.setItem("visiontechEmail", email);

        alert("Cadastro realizado com sucesso!");

        window.location.href = "painel.html";
    });
}


