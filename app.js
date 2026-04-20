const state = {
  config: null,
  data: { queryResults: [], countrySummaries: [], meta: {} },
  filters: {
    country: "all",
    query: "all",
    engine: "all",
  },
};

const elements = {
  countryCheckboxes: document.getElementById("countryCheckboxes"),
  manualKeywordsAe: document.getElementById("manualKeywordsAe"),
  manualKeywordsSa: document.getElementById("manualKeywordsSa"),
  inputMode: document.getElementById("inputMode"),
  experimentSelect: document.getElementById("experimentSelect"),
  engineInput1: document.getElementById("engineInput1"),
  engineInput2: document.getElementById("engineInput2"),
  engineInput3: document.getElementById("engineInput3"),
  engineInput4: document.getElementById("engineInput4"),
  autoControls: document.getElementById("autoControls"),
  manualControls: document.getElementById("manualControls"),
  maxKeywordsPerCountry: document.getElementById("maxKeywordsPerCountry"),
  projectId: document.getElementById("projectId"),
  runButton: document.getElementById("runButton"),
  runStatus: document.getElementById("runStatus"),
  inputSummary: document.getElementById("inputSummary"),
  runMeta: document.getElementById("runMeta"),
  countryFilter: document.getElementById("countryFilter"),
  queryFilter: document.getElementById("queryFilter"),
  engineFilter: document.getElementById("engineFilter"),
  heroMetrics: document.getElementById("heroMetrics"),
  queryTitle: document.getElementById("queryTitle"),
  winnerBanner: document.getElementById("winnerBanner"),
  scoreCards: document.getElementById("scoreCards"),
  reasonList: document.getElementById("reasonList"),
  winnerBreakdown: document.getElementById("winnerBreakdown"),
  productTables: document.getElementById("productTables"),
  countryTitle: document.getElementById("countryTitle"),
  countryRanking: document.getElementById("countryRanking"),
  countryVerdict: document.getElementById("countryVerdict"),
  countryDifferences: document.getElementById("countryDifferences"),
  countryEngineCards: document.getElementById("countryEngineCards"),
};

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function getActiveCountries() {
  return [...document.querySelectorAll('input[name="country"]:checked')].map((item) => item.value);
}

function keywordCount(text) {
  return text
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function getConfiguredEngines() {
  return [
    elements.engineInput1.value,
    elements.engineInput2.value,
    elements.engineInput3.value,
    elements.engineInput4.value,
  ]
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateInputSummary() {
  const aeCount = keywordCount(elements.manualKeywordsAe.value);
  const saCount = keywordCount(elements.manualKeywordsSa.value);
  const mode = elements.inputMode.value;
  const countries = getActiveCountries();
  const engines = getConfiguredEngines();
  const experimentLabel = elements.experimentSelect.selectedOptions[0]?.textContent || "Experiment";

  if (mode === "manual") {
    elements.inputSummary.textContent = `Manual mode: ${experimentLabel} | ${countries.join(", ").toUpperCase() || "No country selected"} | Engines ${engines.length}/4 | AE ${aeCount}/50 | SA ${saCount}/50`;
  } else {
    elements.inputSummary.textContent = `Auto mode: ${experimentLabel} | up to ${elements.maxKeywordsPerCountry.value || 50} keywords per selected country | Engines ${engines.length}/4`;
  }
}

function setStatus(message, tone = "neutral") {
  elements.runStatus.textContent = message;
  elements.runStatus.dataset.tone = tone;
}

function setServerRequiredState() {
  const message = "Open this app through the local server: python3 src/server.py, then visit http://127.0.0.1:8000";
  elements.runButton.disabled = true;
  setStatus(message, "error");
  elements.inputSummary.textContent = "Local file mode detected. Interactive pipeline calls only work over the local server.";
  elements.runMeta.textContent = "Backend not connected.";
}

function getCountries() {
  return [...new Set(state.data.queryResults.map((item) => item.country))].sort();
}

function getEngines() {
  const engines = new Set();
  state.data.queryResults.forEach((result) => {
    result.engine_scores.forEach((score) => engines.add(score.engine));
  });
  return [...engines].sort();
}

function getFilteredQueryResults() {
  return state.data.queryResults.filter((item) => {
    const countryMatch = state.filters.country === "all" || item.country === state.filters.country;
    const queryMatch = state.filters.query === "all" || item.query === state.filters.query;
    return countryMatch && queryMatch;
  });
}

function getVisibleCountrySummary() {
  const country = state.filters.country === "all" ? getCountries()[0] : state.filters.country;
  return state.data.countrySummaries.find((item) => item.country === country) || state.data.countrySummaries[0];
}

function populateSelect(select, options, value) {
  select.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");
  select.value = value;
}

function renderHeroMetrics() {
  const results = getFilteredQueryResults();
  const meta = state.data.meta || {};
  const queries = new Set(results.map((item) => item.query)).size;
  const countries = new Set(state.data.queryResults.map((item) => item.country)).size;
  const engines = new Set(results.flatMap((item) => item.engine_scores.map((score) => score.engine))).size;
  const averageWinnerScore =
    results.reduce((sum, item) => {
      const winningScore = item.engine_scores.find((score) => score.engine === item.winner);
      return sum + (winningScore ? winningScore.score : 0);
    }, 0) / (results.length || 1);

  const metrics = [
    { label: "Visible queries", value: queries || 0 },
    { label: "Countries", value: countries || 0 },
    { label: "Engines", value: engines || 0 },
    { label: "Avg winner score", value: results.length ? averageWinnerScore.toFixed(1) : "0.0" },
  ];

  elements.heroMetrics.innerHTML = metrics
    .map(
      (metric) => `
        <div class="metric-pill">
          <span class="metric-label">${metric.label}</span>
          <span class="metric-value">${metric.value}</span>
        </div>
      `
    )
    .join("");

  const summaryBits = [];
  if (meta.inputMode) summaryBits.push(`Mode: ${meta.inputMode}`);
  if (meta.experimentLabel) summaryBits.push(`Experiment: ${meta.experimentLabel}`);
  if (meta.generatedAt) summaryBits.push(`Generated: ${new Date(meta.generatedAt).toLocaleString()}`);
  if (meta.queryCount !== undefined) summaryBits.push(`Queries returned: ${meta.queryCount}`);
  elements.runMeta.textContent = summaryBits.join(" | ") || "No run has been executed yet.";
}

function renderWinnerBreakdown(filteredResults) {
  const total = filteredResults.length || 1;
  const counts = filteredResults.reduce((acc, item) => {
    acc[item.winner] = (acc[item.winner] || 0) + 1;
    return acc;
  }, {});

  elements.winnerBreakdown.innerHTML = Object.keys(counts).length
    ? Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([engine, count]) => `
            <div class="stack-row">
              <div class="stack-label">${engine}</div>
              <div class="stack-track">
                <div class="stack-fill" style="width:${(count / total) * 100}%"></div>
              </div>
              <div class="stack-value">${count}</div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">Run the pipeline to see winner trends.</div>`;
}

function renderQuerySection() {
  const filtered = getFilteredQueryResults();
  const selected = filtered[0];

  if (!selected) {
    elements.queryTitle.textContent = "Engine comparison";
    elements.winnerBanner.innerHTML = "Run the pipeline to generate query-level comparisons.";
    elements.scoreCards.innerHTML = `<div class="empty-state">No query results yet.</div>`;
    elements.reasonList.innerHTML = `<div class="empty-state">Comparative reasoning appears after a run.</div>`;
    elements.productTables.innerHTML = `<div class="empty-state">Product rank tables appear after a successful pipeline run.</div>`;
    renderWinnerBreakdown([]);
    return;
  }

  elements.queryTitle.textContent = `${selected.query} · ${selected.country.toUpperCase()}`;
  elements.winnerBanner.innerHTML = `
    <strong>${selected.winner}</strong> is the current winner for this query.
    <div class="bar-note">These scores are generated from the live pipeline run, not from pasted demo content.</div>
  `;

  const visibleScores = selected.engine_scores.filter(
    (score) => state.filters.engine === "all" || score.engine === state.filters.engine
  );

  elements.scoreCards.innerHTML = visibleScores
    .sort((a, b) => b.score - a.score)
    .map(
      (score) => `
        <article class="score-card">
          <div class="score-topline">
            <div class="engine-name">${score.engine}</div>
            <div class="score-value">${score.score.toFixed(1)}</div>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${score.score * 10}%"></div>
          </div>
          <div class="bar-note">${score.engine === selected.winner ? "Winner on this query" : "Challenger engine"}</div>
        </article>
      `
    )
    .join("");

  elements.reasonList.innerHTML = selected.reason
    .map((reason) => `<div class="reason-item">${reason}</div>`)
    .join("");

  const visibleProducts = Object.entries(selected.engine_products).filter(
    ([engine]) => state.filters.engine === "all" || engine === state.filters.engine
  );

  elements.productTables.innerHTML = visibleProducts
    .map(([engine, products]) => `
      <section class="product-table">
        <header>
          <h3>${engine}</h3>
          <p>${products.length} returned products shown</p>
        </header>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Product</th>
              <th>Delivery</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map(
                (product) => `
                  <tr>
                    <td>#${product.rank}</td>
                    <td>
                      <div class="product-title">${product.title}</div>
                      <div class="product-meta">${product.brand || "Unknown brand"}</div>
                    </td>
                    <td>${product.delivery_type_tag}</td>
                    <td>${Number(product.rating || 0).toFixed(1)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>
    `)
    .join("");

  renderWinnerBreakdown(filtered);
}

function renderCountrySection() {
  const summary = getVisibleCountrySummary();
  if (!summary) {
    elements.countryTitle.textContent = "Macro summary";
    elements.countryRanking.innerHTML = `<div class="empty-state">Country-level insights appear after a run.</div>`;
    elements.countryVerdict.textContent = "Run the pipeline to generate a country summary.";
    elements.countryDifferences.innerHTML = `<div class="empty-state">No country differences available yet.</div>`;
    elements.countryEngineCards.innerHTML = "";
    return;
  }

  elements.countryTitle.textContent = `Country summary · ${summary.country.toUpperCase()}`;
  elements.countryRanking.innerHTML = summary.ranking
    .map(
      (engine, index) => `
        <div class="ranking-item">
          <div class="ranking-index">${index + 1}</div>
          <div class="ranking-name">${engine}</div>
        </div>
      `
    )
    .join("");

  elements.countryVerdict.textContent = summary.final_verdict;
  elements.countryDifferences.innerHTML = summary.key_differences
    .map((item) => `<div class="difference-item">${item}</div>`)
    .join("");

  elements.countryEngineCards.innerHTML = Object.entries(summary.engine_summary)
    .map(
      ([engine, details]) => `
        <article class="engine-summary-card">
          <h4>${engine}</h4>
          <div class="bar-note">Strengths</div>
          <div class="tag-list">
            ${details.strengths.map((item) => `<span class="tag">${item}</span>`).join("")}
          </div>
          <div class="bar-note" style="margin-top:12px;">Weaknesses</div>
          <div class="tag-list">
            ${details.weaknesses.map((item) => `<span class="tag weak">${item}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
}

function syncFilters() {
  const countries = getCountries();
  const queries = [
    ...new Set(
      state.data.queryResults
        .filter((item) => state.filters.country === "all" || item.country === state.filters.country)
        .map((item) => item.query)
    ),
  ].sort();
  const engines = getEngines();

  if (state.filters.country !== "all" && !countries.includes(state.filters.country)) {
    state.filters.country = "all";
  }
  if (state.filters.query !== "all" && !queries.includes(state.filters.query)) {
    state.filters.query = "all";
  }
  if (state.filters.engine !== "all" && !engines.includes(state.filters.engine)) {
    state.filters.engine = "all";
  }

  populateSelect(
    elements.countryFilter,
    [{ value: "all", label: "All countries" }, ...countries.map((country) => ({ value: country, label: country.toUpperCase() }))],
    state.filters.country
  );
  populateSelect(
    elements.queryFilter,
    [{ value: "all", label: "First query in selection" }, ...queries.map((query) => ({ value: query, label: query }))],
    state.filters.query
  );
  populateSelect(
    elements.engineFilter,
    [{ value: "all", label: "All engines" }, ...engines.map((engine) => ({ value: engine, label: engine }))],
    state.filters.engine
  );
}

function render() {
  syncFilters();
  renderHeroMetrics();
  renderQuerySection();
  renderCountrySection();
}

async function loadConfig() {
  // Static Vercel mode: load pre-exported BigQuery data from dashboard-data.json
  setStaticMode();
  try {
    const response = await fetch("./dashboard-data.json");
    if (!response.ok) throw new Error("dashboard-data.json not found");
    const data = await response.json();
    state.data = data;
    state.data.meta = {
      inputMode: "static",
      experimentLabel: "Pre-exported from BigQuery",
      generatedAt: null,
      queryCount: data.queryResults?.length ?? 0,
    };
    elements.inputSummary.textContent = `Loaded ${data.queryResults?.length ?? 0} queries from pre-exported BigQuery snapshot.`;
    elements.runMeta.textContent = `Country summaries: ${data.countrySummaries?.length ?? 0}`;
  } catch (err) {
    elements.inputSummary.textContent = "Could not load dashboard-data.json. Make sure it is in the same folder.";
    elements.runMeta.textContent = err.message;
  }
  render();
}

function setStaticMode() {
  // Hide the live pipeline panel — not available in static Vercel mode
  const heroPanel = document.querySelector(".hero-panel");
  if (heroPanel) {
    heroPanel.innerHTML = `
      <p class="hero-panel-label">Data Source</p>
      <h2 class="hero-panel-title">Pre-exported BigQuery snapshot</h2>
      <div style="margin-top:14px; color:rgba(255,246,234,0.8); font-size:0.95rem; line-height:1.65;">
        This is a static read-only deployment. The dashboard is powered by data
        exported from <strong style="color:#ffd5bf;">noonbigmerchsandbox.satyam.llm_analytics_v1_long_tail_sa</strong>.<br><br>
        To refresh the data, re-export from BigQuery, run <code>build_dashboard_data.py</code>,
        and redeploy to Vercel.
      </div>
    `;
  }
  setStatus("Static mode: live pipeline is disabled. Showing pre-exported BigQuery data.", "neutral");
  elements.runButton.disabled = true;
}

async function runPipeline() {
  // Live pipeline disabled in static Vercel mode.
  setStatus("Live pipeline is not available in static mode. Redeploy with a refreshed dashboard-data.json to update data.", "error");
  return;
  if (isFileProtocol()) {
    setServerRequiredState();
    return;
  }

  const payload = {
    countries: getActiveCountries(),
    inputMode: elements.inputMode.value,
    experimentKey: elements.experimentSelect.value,
    engines: getConfiguredEngines(),
    projectId: elements.projectId.value,
    maxKeywordsPerCountry: Number(elements.maxKeywordsPerCountry.value || 50),
    productLimit: 10,
    pauseSeconds: 0.15,
    connectTimeout: 5,
    readTimeout: 12,
    manualKeywords: {
      ae: elements.manualKeywordsAe.value,
      sa: elements.manualKeywordsSa.value,
    },
  };

  setStatus("Running pipeline. This can take a bit because each keyword calls multiple search engines.", "running");
  elements.runButton.disabled = true;

  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Pipeline failed");
    }
    state.data = body;
    state.filters = { country: "all", query: "all", engine: "all" };
    setStatus("Pipeline finished successfully.", "success");
    render();
  } catch (error) {
    const helpfulMessage =
      error.message === "Failed to fetch"
        ? "Backend not reachable. Start the app with python3 src/server.py and open http://127.0.0.1:8000"
        : error.message;
    setStatus(helpfulMessage, "error");
  } finally {
    elements.runButton.disabled = false;
  }
}

elements.inputMode.addEventListener("change", () => {
  const autoMode = elements.inputMode.value === "auto";
  elements.autoControls.hidden = !autoMode;
  elements.manualControls.hidden = autoMode;
  updateInputSummary();
});

elements.experimentSelect.addEventListener("change", updateInputSummary);

[elements.manualKeywordsAe, elements.manualKeywordsSa, elements.maxKeywordsPerCountry].forEach((element) => {
  element.addEventListener("input", updateInputSummary);
});

[
  elements.engineInput1,
  elements.engineInput2,
  elements.engineInput3,
  elements.engineInput4,
].forEach((element) => {
  element.addEventListener("input", updateInputSummary);
});

elements.countryCheckboxes.addEventListener("change", updateInputSummary);
elements.runButton.addEventListener("click", runPipeline);

elements.countryFilter.addEventListener("change", (event) => {
  state.filters.country = event.target.value;
  state.filters.query = "all";
  render();
});

elements.queryFilter.addEventListener("change", (event) => {
  state.filters.query = event.target.value;
  render();
});

elements.engineFilter.addEventListener("change", (event) => {
  state.filters.engine = event.target.value;
  render();
});

loadConfig().catch((error) => {
  setStatus(error.message, "error");
  elements.inputSummary.textContent = "Could not load dashboard-data.json.";
  elements.runMeta.textContent = "Make sure dashboard-data.json is present and valid.";
  render();
});
