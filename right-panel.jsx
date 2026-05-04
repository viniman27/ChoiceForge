// Right panel — node inspector

function RightPanel({ node, lang, onUpdateNode }) {
  const t = window.I18N[lang];
  const [tab, setTab] = React.useState("content");

  if (!node) {
    return (
      <aside className="right-panel">
        <div className="empty-inspector">
          <div className="empty-mark">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="24" stroke="var(--ink-mute)" strokeWidth="1" strokeDasharray="3 3"/>
              <path d="M20 24h16M20 30h12" stroke="var(--ink-mute)" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>{t.inspector}</h3>
          <p>{lang === "pt" ? "Selecione um nó no canvas para inspecionar e editar." : "Select a node on the canvas to inspect and edit it."}</p>
          <div className="kbd-hint">
            <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd>
            <span>{lang === "pt" ? "navegar" : "navigate"}</span>
          </div>
        </div>
      </aside>
    );
  }

  const colors = window.TYPE_COLORS[node.type];

  return (
    <aside className="right-panel">
      <div className="ip-head" style={{ "--accent": colors.dot, "--accent-tint": colors.tint }}>
        <div className="ip-type">
          <span className="ip-dot" />
          <window.NodeIcon type={node.type} />
          <span>{t.nodeTypes[node.type]}</span>
        </div>
        <input className="ip-title" defaultValue={node.title} onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}/>
        <div className="ip-meta">
          <span><code>scene:</code> intro_grid</span>
          <span>·</span>
          <span><code>id:</code> {node.id}</span>
        </div>
      </div>

      <div className="ip-tabs">
        {["content", "logic", "raw"].map((id, i) => (
          <button key={id} className={`ip-tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>
            {t.inspectorTabs[i]}
          </button>
        ))}
      </div>

      <div className="ip-body">
        {tab === "content" && <ContentTab node={node} lang={lang} t={t} onUpdateNode={onUpdateNode}/>}
        {tab === "logic" && <LogicTab node={node} lang={lang} t={t}/>}
        {tab === "raw" && <RawTab node={node} lang={lang} t={t}/>}
      </div>

      <div className="ip-footer">
        <span className="ok-pill">✓ {t.linterPasses}</span>
        <span className="dim">{t.indentRule}</span>
      </div>
    </aside>
  );
}

function ContentTab({ node, lang, t, onUpdateNode }) {
  if (node.type === "passage") {
    return (
      <div className="ip-content">
        <label className="ip-label">{t.bodyLabel}</label>
        <div className="ip-editor">
          <NarrativeEditor value={node.body || ""} onChange={(v) => onUpdateNode(node.id, { body: v })}/>
          <div className="ip-editor-foot">
            <span className="dim">{(node.body || "").split(/\s+/).filter(Boolean).length} {t.words}</span>
            <span className="dim">·</span>
            <button className="chip-btn">${"{var}"}</button>
            <button className="chip-btn">@{"{...}"}</button>
            <button className="chip-btn">*set</button>
          </div>
        </div>

        {node.sets && node.sets.length > 0 && (
          <>
            <label className="ip-label">*set</label>
            <ul className="ip-sets">
              {node.sets.map((s, i) => (
                <li key={i} className="ip-set-row">
                  <code className="var-pill">{s.var}</code>
                  <select defaultValue={s.op}>
                    <option>=</option><option>+</option><option>-</option>
                    <option>%+</option><option>%-</option>
                  </select>
                  <input defaultValue={s.val}/>
                  <button className="x-btn">×</button>
                </li>
              ))}
              <li><button className="ghost-btn">+ *set</button></li>
            </ul>
          </>
        )}
      </div>
    );
  }

  if (node.type === "choice") {
    return (
      <div className="ip-content">
        <label className="ip-label">{t.choiceLabel}</label>
        <input className="ip-prompt" defaultValue={node.prompt}/>

        <label className="ip-label">#options</label>
        <ul className="ip-opts">
          {node.options.map((o, i) => (
            <li key={i} className="ip-opt-row">
              <div className="ip-opt-head">
                <span className="opt-num">#{i + 1}</span>
                <input className="ip-opt-text" defaultValue={o.text}/>
                <button className="x-btn">×</button>
              </div>
              <div className="ip-opt-cond">
                <select defaultValue={o.cond?.type || "none"}>
                  <option value="none">{lang === "pt" ? "sem condição" : "no condition"}</option>
                  <option value="if">{lang === "pt" ? "*if (esconde)" : "*if (hides)"}</option>
                  <option value="selectable_if">{lang === "pt" ? "*selectable_if (cinza)" : "*selectable_if (greyed)"}</option>
                </select>
                {o.cond && <input className="cond-input" defaultValue={o.cond.expr}/>}
                <select defaultValue="allow">
                  <option value="allow">*allow_reuse</option>
                  <option value="hide">*hide_reuse</option>
                  <option value="disable">*disable_reuse</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
        <button className="ghost-btn">{t.addOption}</button>
      </div>
    );
  }

  if (node.type === "if") {
    return (
      <div className="ip-content">
        <label className="ip-label">branches</label>
        <ul className="ip-branches">
          {node.branches.map((b, i) => (
            <li key={i} className={`ip-branch branch-${b.kind}`}>
              <span className="branch-key">*{b.kind}</span>
              {b.expr ? <input className="cond-input wide" defaultValue={b.expr}/> : <span className="dim">— {lang === "pt" ? "padrão" : "default"} —</span>}
            </li>
          ))}
        </ul>
        <button className="ghost-btn">+ *elseif</button>
      </div>
    );
  }

  return (
    <div className="ip-content">
      <p className="dim">{lang === "pt" ? "Nó simples — sem campos de conteúdo." : "Simple node — no content fields."}</p>
    </div>
  );
}

function LogicTab({ node, lang, t }) {
  return (
    <div className="ip-logic">
      <label className="ip-label">{lang === "pt" ? "construtor de condição" : "condition builder"}</label>
      <div className="cond-builder">
        <div className="cb-row">
          <select defaultValue="nervos">
            <option>nervos</option><option>codigo</option><option>rua</option>
          </select>
          <select defaultValue=">=">
            <option>=</option><option>!=</option><option>{">"}</option>
            <option>{"<"}</option><option>{">="}</option><option>{"<="}</option>
          </select>
          <input defaultValue="40"/>
          <button className="x-btn">×</button>
        </div>
        <div className="cb-join">
          <button className="join-pill is-active">and</button>
          <button className="join-pill">or</button>
        </div>
        <div className="cb-row">
          <select defaultValue="tem_deck"><option>tem_deck</option></select>
          <select defaultValue="="><option>=</option><option>!=</option></select>
          <input defaultValue="true"/>
          <button className="x-btn">×</button>
        </div>
        <button className="ghost-btn">+ {lang === "pt" ? "adicionar termo" : "add term"}</button>
      </div>

      <label className="ip-label" style={{ marginTop: 16 }}>{lang === "pt" ? "expressão final" : "final expression"}</label>
      <pre className="cond-final"><code>{`(nervos >= 40) and (tem_deck = true)`}</code></pre>

      <label className="ip-label">{lang === "pt" ? "vai para" : "destination"}</label>
      <div className="dest-row">
        <span className="dim">→</span>
        <select defaultValue="n6"><option value="n6">n6 — salto</option></select>
      </div>
    </div>
  );
}

function RawTab({ node, lang, t }) {
  const code = generateChoiceScript(node);
  return (
    <div className="ip-raw">
      <pre className="raw-code"><code dangerouslySetInnerHTML={{ __html: code }}/></pre>
      <div className="raw-foot">
        <label className="toggle-row">
          <input type="checkbox"/> {lang === "pt" ? "permitir edição direta" : "allow direct edit"}
        </label>
      </div>
    </div>
  );
}

function generateChoiceScript(node) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const colorize = (line) => {
    return esc(line)
      .replace(/(\*[a-z_]+)/g, '<span class="cs-cmd">$1</span>')
      .replace(/(#[^\n]+)/g, '<span class="cs-opt">$1</span>')
      .replace(/(\$\{[^}]+\})/g, '<span class="cs-var">$1</span>')
      .replace(/(@\{[^}]+\})/g, '<span class="cs-multi">$1</span>');
  };
  const out = [];
  if (node.title && node.type !== "passage") {} // titles are not in cs unless label
  if (node.type === "label") out.push(`*label ${node.title.replace("*label ", "")}`);
  if (node.body) out.push(node.body);
  if (node.sets) node.sets.forEach((s) => out.push(`*set ${s.var} ${s.op === "=" ? s.val : s.op + " " + s.val}`));
  if (node.type === "choice") {
    out.push("*choice");
    node.options.forEach((o) => {
      let line = "  ";
      if (o.cond) line += `*${o.cond.type} (${o.cond.expr}) `;
      line += `#${o.text}`;
      out.push(line);
      out.push(`    *goto ${o.to || "next"}`);
    });
  }
  if (node.type === "if") {
    node.branches.forEach((b) => {
      out.push(b.expr ? `*${b.kind} (${b.expr})` : `*${b.kind}`);
      out.push(`  *goto ${b.to}`);
    });
  }
  if (node.type === "ending") out.push("*ending");
  if (node.type === "goto_scene") out.push(`*goto_scene ${node.target}`);
  if (node.type === "checkpoint") out.push("*save_checkpoint pre_market");
  return out.map(colorize).join("\n") || "<span class='dim'># empty</span>";
}

function NarrativeEditor({ value, onChange }) {
  const ref = React.useRef(null);
  // contenteditable with live highlight
  const onInput = (e) => onChange(e.currentTarget.innerText);
  React.useEffect(() => {
    if (ref.current && ref.current.dataset.set !== "1") {
      ref.current.innerText = value;
      ref.current.dataset.set = "1";
    }
  }, []);
  return (
    <div className="narr-editor" contentEditable suppressContentEditableWarning ref={ref} onInput={onInput} spellCheck/>
  );
}

window.RightPanel = RightPanel;
