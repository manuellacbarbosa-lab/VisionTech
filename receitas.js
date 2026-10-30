
/* =========================================
   VISIONTECH - GERENCIAMENTO DE RECEITAS
========================================= */

const NOME_BANCO = "VisionTechDB";
const VERSAO_BANCO = 2;

let receitas = [];


// =========================================
// ABRIR BANCO DE DADOS
// =========================================

function abrirBancoReceitas() {
    return new Promise((resolve, reject) => {

        const requisicao = indexedDB.open(
            NOME_BANCO,
            VERSAO_BANCO
        );

        requisicao.onupgradeneeded = function(event) {

            const banco = event.target.result;

            if (!banco.objectStoreNames.contains("produtos")) {
                banco.createObjectStore("produtos", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }

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


// =========================================
// SALVAR RECEITA
// =========================================

async function salvarReceitaBanco(receita) {

    const banco = await abrirBancoReceitas();

    return new Promise((resolve, reject) => {

        const transacao = banco.transaction(
            "receitas",
            "readwrite"
        );

        const armazenamento = transacao.objectStore("receitas");

        const requisicao = receita.id
            ? armazenamento.put(receita)
            : armazenamento.add(receita);

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);

        transacao.oncomplete = () => banco.close();

        transacao.onerror = () => {
            banco.close();
            reject(transacao.error);
        };

    });
}


// =========================================
// BUSCAR RECEITAS
// =========================================

async function buscarReceitasBanco() {

    const banco = await abrirBancoReceitas();

    return new Promise((resolve, reject) => {

        const transacao = banco.transaction(
            "receitas",
            "readonly"
        );

        const requisicao = transacao
            .objectStore("receitas")
            .getAll();

        requisicao.onsuccess = () => resolve(requisicao.result);

        requisicao.onerror = () => reject(requisicao.error);

        transacao.oncomplete = () => banco.close();

    });
}


// =========================================
// BUSCAR PRODUTOS PARA RELATÓRIO
// =========================================

async function buscarProdutosRelatorio() {

    const banco = await abrirBancoReceitas();

    return new Promise((resolve, reject) => {

        const transacao = banco.transaction(
            "produtos",
            "readonly"
        );

        const requisicao = transacao
            .objectStore("produtos")
            .getAll();

        requisicao.onsuccess = () => resolve(requisicao.result);

        requisicao.onerror = () => reject(requisicao.error);

        transacao.oncomplete = () => banco.close();

    });
}


// =========================================
// PROTEÇÃO DE TEXTO HTML
// =========================================

function protegerTexto(texto) {

    return String(texto ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);

}


// =========================================
// ELEMENTOS DA PÁGINA
// =========================================

const formularioReceita = document.getElementById("receitaForm");

const listaReceitas = document.getElementById("listaReceitas");

const totalReceitas = document.getElementById("totalReceitas");

const buscaReceita = document.getElementById("buscaReceita");

const botaoCancelarEdicao = document.getElementById(
    "cancelarEdicaoReceita"
);


// =========================================
// CADASTRAR E EDITAR RECEITA
// =========================================

if (formularioReceita) {

    formularioReceita.addEventListener("submit", async function(event) {

        event.preventDefault();

        const id = document.getElementById("receitaId").value;

        const titulo = document.getElementById(
            "tituloReceita"
        ).value.trim();

        const rendimento = document.getElementById(
            "rendimentoReceita"
        ).value.trim();

        const ingredientes = document.getElementById(
            "ingredientesReceita"
        ).value.trim();

        const preparo = document.getElementById(
            "preparoReceita"
        ).value.trim();


        if (!titulo || !ingredientes || !preparo) {

            alert("Preencha todos os campos obrigatórios.");

            return;
        }


        const receita = {

            titulo: titulo,

            rendimento: rendimento,

            ingredientes: ingredientes,

            preparo: preparo,

            dataAtualizacao: new Date().toISOString()

        };


        if (id) {

            receita.id = Number(id);

            const receitaOriginal = receitas.find(
                item => item.id === Number(id)
            );

            receita.dataCadastro = receitaOriginal
                ? receitaOriginal.dataCadastro
                : new Date().toISOString();

        } else {

            receita.dataCadastro = new Date().toISOString();

        }


        try {

            await salvarReceitaBanco(receita);

            alert(
                id
                    ? "Receita atualizada com sucesso!"
                    : "Receita cadastrada com sucesso!"
            );

            formularioReceita.reset();

            document.getElementById("receitaId").value = "";

            document.getElementById(
                "tituloFormularioReceita"
            ).textContent = "Escrever nova receita";

            botaoCancelarEdicao.hidden = true;

            await atualizarReceitas();

        } catch (erro) {

            console.error(erro);

            alert("Não foi possível salvar a receita.");

        }

    });

}


// =========================================
// MOSTRAR RECEITAS NA TELA
// =========================================

function mostrarReceitas() {

    if (!listaReceitas) return;

    const busca = buscaReceita
        ? buscaReceita.value.trim().toLowerCase()
        : "";

    const filtradas = receitas.filter(receita =>
        receita.titulo.toLowerCase().includes(busca)
    );


    totalReceitas.textContent = receitas.length;


    if (filtradas.length === 0) {

        listaReceitas.innerHTML = `
            <p class="receitas-vazias">
                ${
                    receitas.length === 0
                        ? "Você ainda não escreveu nenhuma receita."
                        : "Nenhuma receita encontrada."
                }
            </p>
        `;

        return;
    }


    listaReceitas.innerHTML = filtradas.map(receita => `

        <article class="receita-card">

            <div class="receita-card-topo">

                <div>

                    <span class="etiqueta-receita">
                        Minha receita
                    </span>

                    <h3>${protegerTexto(receita.titulo)}</h3>

                </div>

                <span class="icone-receita">♨</span>

            </div>


            ${
                receita.rendimento
                    ? `<p class="receita-rendimento">
                        ⏱ ${protegerTexto(receita.rendimento)}
                       </p>`
                    : ""
            }


            <div class="receita-resumo">

                <h4>Ingredientes</h4>

                <p>
                    ${protegerTexto(receita.ingredientes)}
                </p>

            </div>


            <div class="receita-acoes">

                <button
                    type="button"
                    data-acao="visualizar"
                    data-id="${receita.id}"
                    class="btn-visualizar-receita"
                >
                    Visualizar
                </button>

                <button
                    type="button"
                    data-acao="editar"
                    data-id="${receita.id}"
                    class="btn-editar-receita"
                >
                    Editar
                </button>

                <button
                    type="button"
                    data-acao="excluir"
                    data-id="${receita.id}"
                    class="btn-excluir-receita"
                >
                    Excluir
                </button>

            </div>

        </article>

    `).join("");

}


// =========================================
// VISUALIZAR, EDITAR E EXCLUIR
// =========================================

if (listaReceitas) {

    listaReceitas.addEventListener("click", async function(event) {

        const botao = event.target.closest("button[data-acao]");

        if (!botao) return;

        const id = Number(botao.dataset.id);

        const receita = receitas.find(item => item.id === id);

        if (!receita) return;


        const acao = botao.dataset.acao;


        // VISUALIZAR

        if (acao === "visualizar") {

            alert(
                "RECEITA: " + receita.titulo +

                "\n\nRENDIMENTO / TEMPO: " +
                (receita.rendimento || "Não informado") +

                "\n\nINGREDIENTES:\n" +
                receita.ingredientes +

                "\n\nMODO DE PREPARO:\n" +
                receita.preparo
            );

        }


        // EDITAR

        if (acao === "editar") {

            document.getElementById("receitaId").value = receita.id;

            document.getElementById("tituloReceita").value =
                receita.titulo;

            document.getElementById("rendimentoReceita").value =
                receita.rendimento || "";

            document.getElementById("ingredientesReceita").value =
                receita.ingredientes;

            document.getElementById("preparoReceita").value =
                receita.preparo;

            document.getElementById(
                "tituloFormularioReceita"
            ).textContent = "Editar receita";

            botaoCancelarEdicao.hidden = false;

            formularioReceita.scrollIntoView({
                behavior: "smooth"
            });

        }


        // EXCLUIR

        if (acao === "excluir") {

            const confirmar = confirm(
                `Deseja realmente excluir a receita "${receita.titulo}"?`
            );

            if (!confirmar) return;

            try {

                const banco = await abrirBancoReceitas();

                await new Promise((resolve, reject) => {

                    const transacao = banco.transaction(
                        "receitas",
                        "readwrite"
                    );

                    transacao.objectStore("receitas").delete(id);

                    transacao.oncomplete = resolve;

                    transacao.onerror = () => reject(transacao.error);

                });

                banco.close();

                alert("Receita excluída com sucesso!");

                await atualizarReceitas();

            } catch (erro) {

                console.error(erro);

                alert("Não foi possível excluir a receita.");

            }

        }

    });

}


// =========================================
// CANCELAR EDIÇÃO
// =========================================

if (botaoCancelarEdicao) {

    botaoCancelarEdicao.addEventListener("click", function() {

        formularioReceita.reset();

        document.getElementById("receitaId").value = "";

        document.getElementById(
            "tituloFormularioReceita"
        ).textContent = "Escrever nova receita";

        botaoCancelarEdicao.hidden = true;

    });

}


// =========================================
// PESQUISAR RECEITAS
// =========================================

if (buscaReceita) {

    buscaReceita.addEventListener("input", mostrarReceitas);

}


// =========================================
// ATUALIZAR RECEITAS
// =========================================

async function atualizarReceitas() {

    receitas = await buscarReceitasBanco();

    mostrarReceitas();

}


// =========================================
// EXPORTAR RELATÓRIO EM EXCEL (CSV)
// =========================================

async function exportarRelatorioExcel() {

    try {

        const produtos = await buscarProdutosRelatorio();

        const receitasSalvas = await buscarReceitasBanco();

        const linhas = [

            ["RELATÓRIO VISIONTECH"],

            [],

            ["PRODUTOS CADASTRADOS"],

            [
                "Nome",
                "Lote",
                "Categoria",
                "Quantidade",
                "Validade",
                "Checklist"
            ]

        ];


        produtos.forEach(produto => {

            linhas.push([

                produto.nome,

                produto.lote,

                produto.categoria,

                produto.quantidade,

                produto.validade,

                `${(produto.qualidade || []).length}/5`

            ]);

        });


        linhas.push([]);

        linhas.push(["RECEITAS CADASTRADAS"]);

        linhas.push([
            "Título",
            "Rendimento / Tempo",
            "Ingredientes",
            "Modo de preparo"
        ]);


        receitasSalvas.forEach(receita => {

            linhas.push([

                receita.titulo,

                receita.rendimento || "",

                receita.ingredientes,

                receita.preparo

            ]);

        });


        const csv = linhas.map(linha =>

            linha.map(valor =>

                `"${String(valor ?? "").replace(/"/g, '""')}"`

            ).join(";")

        ).join("\r\n");


        const arquivo = new Blob(

            ["\uFEFF" + csv],

            { type: "text/csv;charset=utf-8;" }

        );


        const url = URL.createObjectURL(arquivo);

        const link = document.createElement("a");

        link.href = url;

        link.download = "relatorio-completo-visiontech.csv";

        link.click();

        URL.revokeObjectURL(url);

    } catch (erro) {

        console.error(erro);

        alert("Não foi possível gerar o relatório.");

    }

}


// =========================================
// EXPORTAR RELATÓRIO EM PDF
// =========================================

async function exportarRelatorioPDF() {

    try {

        const produtos = await buscarProdutosRelatorio();

        const receitasSalvas = await buscarReceitasBanco();

        const janela = window.open("", "_blank");

        if (!janela) {

            alert("Permita a abertura de janelas para gerar o PDF.");

            return;

        }


        const linhasProdutos = produtos.map(produto => `

            <tr>

                <td>${protegerTexto(produto.nome)}</td>

                <td>${protegerTexto(produto.lote)}</td>

                <td>${protegerTexto(produto.categoria)}</td>

                <td>${produto.quantidade}</td>

                <td>${protegerTexto(produto.validade)}</td>

            </tr>

        `).join("");


        const blocosReceitas = receitasSalvas.map(receita => `

            <article class="receita">

                <h3>${protegerTexto(receita.titulo)}</h3>

                <p>
                    <strong>Rendimento / tempo:</strong>
                    ${protegerTexto(receita.rendimento || "Não informado")}
                </p>

                <h4>Ingredientes</h4>

                <p>${protegerTexto(receita.ingredientes).replace(/\n/g, "<br>")}</p>

                <h4>Modo de preparo</h4>

                <p>${protegerTexto(receita.preparo).replace(/\n/g, "<br>")}</p>

            </article>

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

                    h1, h2 {
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

                    .receita {
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        padding: 15px;
                        margin: 15px 0;
                        break-inside: avoid;
                    }

                    .receita h3 {
                        color: #1e40af;
                    }

                    .receita p {
                        white-space: normal;
                        line-height: 1.5;
                    }

                    @media print {
                        body { padding: 0; }
                    }

                </style>

            </head>

            <body>

                <h1>VisionTech</h1>

                <p>Relatório completo de produtos e receitas</p>

                <h2>Produtos cadastrados (${produtos.length})</h2>

                <table>

                    <thead>

                        <tr>
                            <th>Produto</th>
                            <th>Lote</th>
                            <th>Categoria</th>
                            <th>Quantidade</th>
                            <th>Validade</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${
                            linhasProdutos ||
                            "<tr><td colspan='5'>Nenhum produto cadastrado.</td></tr>"
                        }

                    </tbody>

                </table>


                <h2>Receitas cadastradas (${receitasSalvas.length})</h2>

                ${blocosReceitas || "<p>Nenhuma receita cadastrada.</p>"}

            </body>

            </html>

        `);


        janela.document.close();

        janela.onload = () => janela.print();

    } catch (erro) {

        console.error(erro);

        alert("Não foi possível gerar o PDF.");

    }

}


// =========================================
// BOTÕES DE EXPORTAÇÃO
// =========================================

const botaoPDFCompleto = document.getElementById(
    "exportarPDFCompleto"
);

const botaoExcelCompleto = document.getElementById(
    "exportarExcelCompleto"
);


if (botaoPDFCompleto) {

    botaoPDFCompleto.addEventListener(
        "click",
        exportarRelatorioPDF
    );

}


if (botaoExcelCompleto) {

    botaoExcelCompleto.addEventListener(
        "click",
        exportarRelatorioExcel
    );

}


// =========================================
// INICIALIZAÇÃO
// =========================================

atualizarReceitas().catch(erro => {

    console.error(erro);

    alert("Não foi possível carregar as receitas.");

});
