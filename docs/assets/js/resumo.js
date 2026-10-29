(function () {
  "use strict";
  var L = window.LIRA, R = window.LIRA_RESUMO, esc = L.esc;
  L.montarChrome("resumo");
  function $(id) { return document.getElementById(id); }

  var param = new URLSearchParams(location.search).get("id");
  var atual = L.porChave(param) || L.principal().lev;
  var blobAtual = null;

  function seletor() {
    $("selLev").innerHTML = L.levantamentos.slice().reverse().map(function (l) {
      return '<option value="' + esc(l.chave) + '"' + (l === atual ? " selected" : "") + ">" + esc(l.nome + " · " + l.semana_exibicao.rotulo + (l.status === "sem_dados" ? " (sem dados)" : "")) + "</option>";
    }).join("");
    var i = L.levantamentos.indexOf(atual);
    $("btnAnt").disabled = i <= 0; $("btnProx").disabled = i >= L.levantamentos.length - 1;
  }
  function aviso(id, msg) {
    var el = $(id); el.textContent = msg; clearTimeout(el._t);
    el._t = setTimeout(function () { el.textContent = ""; }, 3500);
  }
  function ir(chave) {
    atual = L.porChave(chave) || atual;
    try { history.replaceState(null, "", "?id=" + encodeURIComponent(atual.chave)); } catch (e) { /* ok */ }
    render();
  }
  function atualizarLinkZap() {
    $("btnZap").href = "https://wa.me/?text=" + encodeURIComponent($("textoZap").value);
  }

  function render() {
    seletor();
    document.title = "Resumo LIRAa " + atual.nome + " — Ponta Porã";
    var sem = atual.status !== "com_dados";
    $("conteudoRes").hidden = sem; $("semDados").hidden = !sem;
    blobAtual = null;
    if (sem) {
      $("semDados").innerHTML = '<div class="card"><div class="vazio"><strong>' + esc(atual.nome) + " ainda não tem dados</strong>" +
        "O resumo e a imagem são gerados automaticamente assim que o levantamento for coletado.<br>" + esc(atual.semana_exibicao.rotulo) + "</div></div>";
      return;
    }
    var t = R.texto(atual);
    $("textoZap").value = t;
    $("previa").innerHTML = R.textoHtml(t);
    atualizarLinkZap();
    R.desenharImagem($("cvImagem"), atual).then(function () { $("cvImagem").dataset.pronto = atual.chave; });
  }

  $("textoZap").addEventListener("input", function () { $("previa").innerHTML = R.textoHtml(this.value); atualizarLinkZap(); });
  $("btnCopiar").addEventListener("click", function () {
    var t = $("textoZap").value;
    function fallback() { var ta = $("textoZap"); ta.select(); try { document.execCommand("copy"); aviso("fbTexto", "Texto copiado!"); } catch (e) { aviso("fbTexto", "Não foi possível copiar."); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { aviso("fbTexto", "Texto copiado!"); }, fallback);
    else fallback();
  });
  function gerarBlob(cb) { $("cvImagem").toBlob(cb, "image/png"); }
  $("btnBaixar").addEventListener("click", function () {
    gerarBlob(function (b) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = R.nomeArquivo(atual, "status") + ".png";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      aviso("fbImg", "Imagem baixada!");
    });
  });
  if (navigator.canShare && typeof File === "function") {
    $("btnCompartilhar").hidden = false;
    $("btnCompartilhar").addEventListener("click", function () {
      gerarBlob(function (b) {
        var f = new File([b], R.nomeArquivo(atual, "status") + ".png", { type: "image/png" });
        if (navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: $("textoZap").value }).catch(function () {});
        else aviso("fbImg", "Compartilhamento não suportado: use Baixar.");
      });
    });
  }
  $("selLev").addEventListener("change", function () { ir(this.value); });
  $("btnAnt").addEventListener("click", function () { ir(L.levantamentos[L.levantamentos.indexOf(atual) - 1].chave); });
  $("btnProx").addEventListener("click", function () { ir(L.levantamentos[L.levantamentos.indexOf(atual) + 1].chave); });
  render();
})();
