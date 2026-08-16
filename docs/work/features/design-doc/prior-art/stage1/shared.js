/*
 * Shared behaviour for the Stage 1 prototypes.
 *
 * Everything that must be identical across prototypes A, D and E lives here:
 * lens handling, codebase-relative markers, the fixed eleven-section detail
 * document, Gherkin rendering, model-driven sequence diagrams, comments with
 * mentions, the proposal review, and the canvas layout engine.
 *
 * Each prototype file supplies only its navigation shell.
 */
((global) => {
  const S = global.SAMPLE;

  /* ------------------------------------------------------------- indexes */

  const byId = {
    actor: Object.fromEntries(S.actors.map((a) => [a.id, a])),
    block: Object.fromEntries(S.blocks.map((b) => [b.id, b])),
    behaviour: Object.fromEntries(S.behaviours.map((b) => [b.id, b])),
    link: Object.fromEntries(S.links.map((l) => [l.id, l])),
    useCase: Object.fromEntries(S.useCases.map((u) => [u.id, u])),
    service: Object.fromEntries(
      S.contexts.flatMap((c) =>
        c.services.map((s) => [s.id, { ...s, contextId: c.id }]),
      ),
    ),
    context: Object.fromEntries(S.contexts.map((c) => [c.id, c])),
  };

  const useCasesByService = {};
  for (const u of S.useCases) {
    if (!useCasesByService[u.serviceId]) useCasesByService[u.serviceId] = [];
    useCasesByService[u.serviceId].push(u);
  }

  const behaviourByUseCase = Object.fromEntries(
    S.behaviours.filter((b) => b.useCaseId).map((b) => [b.useCaseId, b]),
  );

  /* External integrations read as their business counterpart in the Product lens. */
  const productAlias = {
    'bb-payments': 'Payment provider',
    'bb-sms': 'SMS gateway',
  };

  /* ------------------------------------------------------------ app state */

  /* Some browsers refuse localStorage on file:// origins, so lens memory is
     best-effort: the Product lens is the first-visit default either way. */
  const LENS_KEY = 'ddw-lens';
  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
  };

  const state = {
    lens: store.get(LENS_KEY) || 'product', // Product lens on first visit
    selection: null, // {kind: 'useCase'|'actor'|'block', id}
    filters: { types: new Set(), actorId: null, query: '' },
    proposalReviewed: false,
    listeners: new Set(),
  };

  function setLens(lens) {
    state.lens = lens;
    store.set(LENS_KEY, lens);
    emit();
  }
  function select(kind, id) {
    state.selection = id ? { kind, id } : null;
    emit();
  }
  function onChange(fn) {
    state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  }
  function emit() {
    for (const fn of state.listeners) fn(state);
  }

  /* ---------------------------------------------------------- DOM helpers */

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on'))
        el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object')
        Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(
        typeof kid === 'string' ? document.createTextNode(kid) : kid,
      );
    }
    return el;
  }
  const clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  };
  const esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );

  /* --------------------------------------------------- markers and badges */

  const MARKER = {
    new: {
      glyph: '+',
      word: 'New',
      title: 'Not present in the scanned codebase',
    },
    modified: {
      glyph: '±',
      word: 'Modified',
      title: 'A baseline-comparable field differs from the scanned codebase',
    },
    removed: {
      glyph: '−',
      word: 'Removed',
      title: 'Present in the scanned codebase, marked here for removal',
    },
  };

  /* Existing is the unmarked baseline, so this returns null for it. */
  function marker(st, opts) {
    const m = MARKER[st];
    if (!m) return null;
    return h(
      'span',
      { class: `marker ${st}`, title: m.title },
      h('span', { class: 'glyph', 'aria-hidden': 'true' }, m.glyph),
      opts?.glyphOnly ? '' : m.word,
    );
  }

  function typeBadge(type) {
    return h(
      'span',
      { class: `badge-type ${type}`, title: 'Behaviour type' },
      type,
    );
  }

  /* ------------------------------------------------------------- top bar */

  function renderTopbar(host, opts) {
    const bar = h(
      'div',
      { class: 'topbar' },
      h(
        'div',
        { class: 'doc-id' },
        h('h1', {}, S.doc.name),
        h('span', { class: 'proto-tag' }, opts.protoLabel),
      ),
      h(
        'span',
        { class: 'chip status-draft', title: 'Document lifecycle state' },
        S.doc.status,
      ),
      h(
        'span',
        {
          class: 'chip',
          title: `Baseline scan ${S.doc.baseline.scanId} of ${S.doc.baseline.repository}`,
        },
        `Baseline ${S.doc.baseline.scannedAt}`,
      ),
      h(
        'button',
        {
          class: 'chip',
          title:
            'A newer source-code scan is available. Refreshing is an explicit action.',
          onclick: () =>
            toast(
              'Baseline refresh would ask an agent for a reconciled proposal. Nothing changes until you accept it.',
            ),
        },
        '◆ Newer scan available',
      ),
      h('span', { class: 'spacer' }),
      proposalPill(),
      lensSwitch(),
      presenceStack(),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: openTasks,
          title: 'The ten Stage 1 comparison tasks',
        },
        '? Tasks',
      ),
    );
    host.appendChild(bar);
    return bar;
  }

  function lensSwitch() {
    const wrap = h('div', {
      class: 'lens',
      role: 'group',
      'aria-label': 'Lens',
    });
    const mk = (id, label) => {
      const b = h(
        'button',
        { type: 'button', onclick: () => setLens(id) },
        label,
      );
      const sync = () =>
        b.setAttribute('aria-pressed', String(state.lens === id));
      sync();
      onChange(sync);
      return b;
    };
    wrap.append(mk('product', 'Product'), mk('technical', 'Technical'));
    return wrap;
  }

  function presenceStack() {
    return h(
      'div',
      {
        class: 'presence',
        title: S.presence.map((p) => `${p.name} (${p.role})`).join('\n'),
      },
      S.presence.map((p) =>
        h(
          'span',
          {
            class: `who${p.agent ? ' agent' : ''}`,
            style: { background: p.colour },
          },
          p.initials,
        ),
      ),
    );
  }

  function proposalPill() {
    const pill = h(
      'span',
      { class: 'proposal-pill' },
      h('span', { class: 'dot' }),
      h('span', {}, '1 proposal pending'),
      h('button', { onclick: openProposal }, 'Review'),
    );
    const sync = () => {
      pill.hidden = state.proposalReviewed === 'accepted';
    };
    sync();
    onChange(sync);
    return pill;
  }

  /* ----------------------------------------------------------- catalogue */

  function renderCatalogue(host, opts) {
    opts = opts || {};
    const body = h('div', { class: 'catalogue-body' });
    const search = h('input', {
      class: 'search',
      type: 'search',
      placeholder: 'Search use cases…',
      'aria-label': 'Search use cases',
      oninput: (e) => {
        state.filters.query = e.target.value.toLowerCase();
        paint();
      },
    });
    const typeFilters = ['command', 'query', 'event'].map((t) =>
      h(
        'button',
        {
          class: 'filter',
          type: 'button',
          'aria-pressed': 'false',
          onclick: (e) => {
            state.filters.types.has(t)
              ? state.filters.types.delete(t)
              : state.filters.types.add(t);
            e.currentTarget.setAttribute(
              'aria-pressed',
              String(state.filters.types.has(t)),
            );
            paint();
          },
        },
        t[0].toUpperCase() + t.slice(1),
      ),
    );

    const actorFilter = h(
      'select',
      {
        class: 'filter',
        'aria-label': 'Filter by actor',
        onchange: (e) => {
          state.filters.actorId = e.target.value || null;
          paint();
          if (e.target.value) select('actor', e.target.value);
        },
      },
      h('option', { value: '' }, 'Any actor'),
      S.actors.map((a) => h('option', { value: a.id }, a.name)),
    );

    const head = h(
      'div',
      { class: 'catalogue-head' },
      search,
      h('div', { class: 'filters' }, typeFilters, actorFilter),
    );

    const root = h('div', { class: 'catalogue' }, head, body);
    host.appendChild(root);

    function visible(u) {
      const f = state.filters;
      if (f.types.size && !f.types.has(u.type)) return false;
      if (f.actorId && !u.actors.includes(f.actorId)) return false;
      if (
        f.query &&
        !(
          u.name.toLowerCase().includes(f.query) ||
          (u.summary || '').toLowerCase().includes(f.query)
        )
      )
        return false;
      return true;
    }

    function paint() {
      clear(body);
      const sel = state.selection;
      const related =
        sel && sel.kind === 'actor'
          ? new Set(
              S.useCases
                .filter((u) => u.actors.includes(sel.id))
                .map((u) => u.id),
            )
          : null;

      for (const ctx of S.contexts) {
        const ctxEl = h(
          'div',
          { class: 'ctx' },
          h('div', { class: 'ctx-name' }, ctx.name, marker(ctx.state)),
        );
        let ctxCount = 0;
        for (const svc of ctx.services) {
          const list = (useCasesByService[svc.id] || []).filter(visible);
          if (!list.length) continue;
          ctxCount += list.length;
          const rows = h('div', {});
          const svcEl = h(
            'div',
            { class: 'svc' },
            h(
              'button',
              {
                class: 'svc-name',
                type: 'button',
                'aria-expanded': 'true',
                onclick: (e) => {
                  const open = rows.hidden;
                  rows.hidden = !open;
                  e.currentTarget.setAttribute('aria-expanded', String(open));
                  e.currentTarget.querySelector('.caret').textContent = open
                    ? '▾'
                    : '▸';
                },
              },
              h('span', { class: 'caret' }, '▾'),
              svc.name,
              marker(svc.state),
              h('span', { class: 'count' }, String(list.length)),
            ),
            rows,
          );

          for (const u of list) {
            const row = h(
              'button',
              {
                class:
                  'uc-row' +
                  (u.state === 'removed' ? ' removed' : '') +
                  (related && !related.has(u.id) ? ' dim' : ''),
                type: 'button',
                'aria-current': String(
                  state.selection &&
                    state.selection.kind === 'useCase' &&
                    state.selection.id === u.id,
                ),
                onclick: () =>
                  (opts.onSelect || ((id) => select('useCase', id)))(u.id),
                ondblclick: () => opts.onOpen?.(u.id),
              },
              h('span', { class: 'nm' }, u.name),
              marker(u.state, { glyphOnly: false }),
              typeBadge(u.type),
            );
            rows.appendChild(row);
          }
          ctxEl.appendChild(svcEl);
        }
        if (ctxCount) body.appendChild(ctxEl);
      }

      if (!body.childElementCount)
        body.appendChild(
          h('div', { class: 'hint' }, 'No use cases match these filters.'),
        );

      for (const hint of S.doc.hints) {
        body.appendChild(
          h(
            'div',
            { class: 'hint' },
            h('span', {}, '·'),
            h('span', {}, hint.text),
          ),
        );
      }
    }

    paint();
    onChange(paint);
    return { paint, root };
  }

  /* ------------------------------------------- fixed eleven-section detail */

  const SECTIONS = [
    'Summary',
    'Actors',
    'Description',
    'Rules',
    'Input',
    'Output',
    'Acceptance scenarios',
    'Quality attributes',
    'Related building blocks',
    'Interaction flow',
    'Comments',
  ];
  const TECHNICAL_ONLY = new Set([
    'Related building blocks',
    'Interaction flow',
  ]);

  function section(name, contentFn, meta) {
    const sec = h('section', { class: 'section', 'data-section': name });
    const head = h('h3', {}, name);
    if (meta) head.appendChild(h('span', { class: 'lens-note' }, meta));
    sec.appendChild(head);
    const content = contentFn();
    sec.appendChild(content || emptyPrompt(name));
    return sec;
  }

  function emptyPrompt(name) {
    return h(
      'div',
      { class: 'empty' },
      h(
        'button',
        {
          type: 'button',
          onclick: () => toast(`Would start editing ${name}.`),
        },
        `Add ${name.toLowerCase()}`,
      ),
      ' — nothing here yet.',
    );
  }

  function editable(text, opts) {
    return h(
      'div',
      {
        class: `editable ${opts?.class || ''}`,
        contenteditable: 'true',
        spellcheck: 'false',
        onblur: () =>
          toast(
            'Edit saved for every collaborator (prototype: not persisted).',
          ),
      },
      text,
    );
  }

  /* Renders the full document for a use case. `opts.compact` trims it to a
     preview (used by prototype D's preview step). */
  function renderUseCaseDoc(host, uc, opts) {
    opts = opts || {};
    clear(host);
    const svc = byId.service[uc.serviceId];
    const ctx = byId.context[uc.contextId];

    const head = h(
      'div',
      { class: 'doc-head' },
      h(
        'div',
        { class: 'title-row' },
        h('h2', {}, uc.name),
        typeBadge(uc.type),
        marker(uc.state),
        h('div', { class: 'head-actions' }, opts.headActions || []),
      ),
      h(
        'div',
        { class: 'path' },
        `${ctx.name} → ${svc.name}`,
        uc.state === 'modified' && uc.baselineDiff
          ? h(
              'button',
              {
                class: 'btn sm ghost',
                style: { marginLeft: '8px' },
                onclick: () => openBaselineDiff(uc),
              },
              'What changed vs the codebase?',
            )
          : null,
      ),
    );

    const body = h('div', { class: 'doc-body' });
    const shown = SECTIONS.filter(
      (s) => state.lens === 'technical' || !TECHNICAL_ONLY.has(s),
    );
    const list = opts.compact
      ? shown.filter((s) =>
          ['Summary', 'Actors', 'Description', 'Acceptance scenarios'].includes(
            s,
          ),
        )
      : shown;

    for (const name of list) body.appendChild(buildSection(name, uc, opts));

    if (opts.compact) {
      body.appendChild(
        h(
          'div',
          { class: 'hint' },
          `${shown.length - list.length} more sections in the full workspace`,
        ),
      );
    }

    host.append(head, body);
    return { head, body };
  }

  function buildSection(name, uc, _opts) {
    switch (name) {
      case 'Summary':
        return section('Summary', () =>
          uc.summary ? editable(uc.summary, { class: 'summary-text' }) : null,
        );

      case 'Actors':
        return section('Actors', () => {
          if (!uc.actors.length) return null;
          return h(
            'div',
            { class: 'actor-list' },
            uc.actors.map((id) => {
              const a = byId.actor[id];
              return h(
                'button',
                {
                  class: 'actor-pill',
                  type: 'button',
                  title: a.description,
                  onclick: () => select('actor', a.id),
                },
                h('span', { class: 'ico' }, a.kind === 'human' ? '☻' : '▤'),
                a.name,
                marker(a.state),
              );
            }),
          );
        });

      case 'Description':
        return section('Description', () => {
          if (!uc.description) return null;
          const el = editable(uc.description);
          if (uc.descriptionAuthor === 'human') {
            el.title =
              'Authored by a person. Agents preserve it by default and must justify any change.';
          }
          return el;
        });

      case 'Rules':
        return section('Rules', () => {
          if (!uc.rules.length) return null;
          return h(
            'ul',
            { class: 'rules' },
            uc.rules.map((r) =>
              h(
                'li',
                { class: r.challenged ? 'challenged' : '' },
                h(
                  'span',
                  { contenteditable: 'true', spellcheck: 'false' },
                  r.text,
                ),
                r.author === 'human'
                  ? h(
                      'span',
                      { class: 'authored', title: 'Authored by a person' },
                      'person',
                    )
                  : null,
                r.challenged
                  ? h(
                      'button',
                      { class: 'btn sm ghost', onclick: openProposal },
                      'challenged by proposal',
                    )
                  : null,
              ),
            ),
          );
        });

      case 'Input':
        return section(
          'Input',
          () => renderFields(uc.input),
          state.lens === 'product'
            ? 'what the caller provides'
            : 'typed structure',
        );

      case 'Output':
        return section(
          'Output',
          () => {
            if (state.lens === 'product')
              return uc.output.summary ? editable(uc.output.summary) : null;
            return renderTypedTable(uc.output.fields);
          },
          state.lens === 'product'
            ? 'what the caller gets back'
            : 'typed structure',
        );

      case 'Acceptance scenarios':
        return section(
          'Acceptance scenarios',
          () => {
            if (!uc.scenarios.length) return null;
            return h(
              'div',
              {},
              uc.scenarios.map((sc) => renderScenario(sc, uc)),
            );
          },
          `${uc.scenarios.length} scenario${uc.scenarios.length === 1 ? '' : 's'}`,
        );

      case 'Quality attributes':
        return section('Quality attributes', () => {
          if (!uc.quality.length) return null;
          return h(
            'ul',
            { class: 'plain-fields' },
            uc.quality.map((q) =>
              h(
                'li',
                {},
                h('strong', {}, `${q.name}: `),
                h(
                  'span',
                  { contenteditable: 'true', spellcheck: 'false' },
                  q.text,
                ),
              ),
            ),
          );
        });

      case 'Related building blocks':
        return section(
          'Related building blocks',
          () => {
            if (!uc.blocks.length) return null;
            return h(
              'div',
              { class: 'block-grid' },
              uc.blocks.map((id) => {
                const b = byId.block[id];
                return h(
                  'button',
                  {
                    class: 'block-card',
                    type: 'button',
                    dataset: { state: b.state },
                    onclick: () => select('block', b.id),
                  },
                  h('span', { class: 'bname' }, b.name),
                  h('span', { class: 'kind-chip' }, b.type),
                  marker(b.state),
                );
              }),
            );
          },
          'Technical lens',
        );

      case 'Interaction flow':
        return section(
          'Interaction flow',
          () => {
            if (!uc.flow.length) return null;
            const list = h(
              'div',
              { class: 'flow-list' },
              uc.flow.map((lid, i) => {
                const l = byId.link[lid];
                return h(
                  'div',
                  { class: 'flow-row' },
                  h('span', { class: 'idx' }, String(i + 1)),
                  h(
                    'span',
                    {},
                    behaviourLabel(l.from),
                    ' ',
                    h('span', { class: 'rel' }, l.type),
                    ' ',
                    behaviourLabel(l.to),
                    l.label
                      ? h('span', { class: 'lbl' }, ` — ${l.label}`)
                      : null,
                  ),
                  marker(l.state) || h('span', {}),
                );
              }),
            );
            return h(
              'div',
              {},
              h(
                'div',
                { class: 'hint', style: { padding: '0 0 6px' } },
                'Same model as the canvas graph — editing either representation updates the other.',
              ),
              list,
            );
          },
          'Technical lens',
        );

      case 'Comments':
        return section(
          'Comments',
          () => renderComments(uc),
          `${uc.comments.length} thread${uc.comments.length === 1 ? '' : 's'}`,
        );
    }
  }

  /* One typed field list backs both lenses: the Product lens reads the
     business label, the Technical lens adds the field name and type. */
  function renderFields(input) {
    if (state.lens === 'product') {
      if (!input.fields.length) return null;
      return h(
        'ul',
        { class: 'plain-fields' },
        input.fields.map((f) =>
          h(
            'li',
            {},
            h(
              'span',
              { contenteditable: 'true', spellcheck: 'false' },
              f.label || f.name,
            ),
            f.note ? h('span', { class: 'fnote' }, ` — ${f.note}`) : null,
          ),
        ),
      );
    }
    return renderTypedTable(input.fields);
  }

  function renderTypedTable(fields) {
    if (!fields?.length) return null;
    return h(
      'table',
      { class: 'fields' },
      h(
        'tbody',
        {},
        fields.map((f) =>
          h(
            'tr',
            {},
            h('td', { class: 'fname' }, f.name),
            h('td', { class: 'ftype' }, f.type),
            h('td', { class: 'fnote' }, f.note || ''),
            h('td', { style: { width: '1%' } }, marker(f.state) || ''),
          ),
        ),
      ),
    );
  }

  function behaviourLabel(bid) {
    const b = byId.behaviour[bid];
    if (!b) return bid;
    return b.name;
  }

  /* ---------------------------------------------------- Gherkin scenarios */

  function renderScenario(sc, uc) {
    const body = h(
      'div',
      { class: 'sc-body' },
      gherkin(sc),
      h(
        'div',
        { style: { marginTop: '10px', display: 'flex', gap: '6px' } },
        h(
          'button',
          { class: 'btn sm', onclick: () => openSequence(sc, uc) },
          '⇉ Sequence diagram',
        ),
        h(
          'button',
          {
            class: 'btn sm ghost',
            onclick: () =>
              toast(
                'Would edit the scenario path: which behaviour links this scenario exercises, in order.',
              ),
          },
          `Path: ${sc.path.length} step${sc.path.length === 1 ? '' : 's'}`,
        ),
      ),
    );
    body.hidden = true;

    const el = h(
      'div',
      { class: 'scenario' },
      h(
        'button',
        {
          class: 'sc-head',
          type: 'button',
          'aria-expanded': 'false',
          onclick: (e) => {
            body.hidden = !body.hidden;
            e.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
            e.currentTarget.querySelector('.caret').textContent = body.hidden
              ? '▸'
              : '▾';
          },
        },
        h(
          'span',
          {
            class: 'caret',
            style: { fontSize: '10px', color: 'var(--muted-foreground)' },
          },
          '▸',
        ),
        h('span', { class: 'sc-title' }, sc.title),
        sc.outline
          ? h('span', { class: 'kind-chip' }, 'Scenario Outline')
          : null,
        (sc.tags || []).map((t) => h('span', { class: 'tag' }, t)),
      ),
      body,
    );
    return el;
  }

  function gherkin(sc) {
    const wrap = h('div', {
      class: 'gherkin',
      contenteditable: 'true',
      spellcheck: 'false',
    });
    if (sc.background?.length) {
      wrap.appendChild(h('div', { class: 'g-block-label' }, 'Background'));
      for (const s of sc.background) wrap.appendChild(line(s));
    }
    wrap.appendChild(
      h(
        'div',
        { class: 'g-block-label' },
        sc.outline ? 'Scenario Outline' : 'Scenario',
      ),
    );
    for (const s of sc.steps) wrap.appendChild(line(s));
    if (sc.examples) {
      wrap.appendChild(h('div', { class: 'g-block-label' }, 'Examples'));
      wrap.appendChild(
        h(
          'table',
          { class: 'examples' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              sc.examples.headers.map((x) => h('th', {}, x)),
            ),
          ),
          h(
            'tbody',
            {},
            sc.examples.rows.map((r) =>
              h(
                'tr',
                {},
                r.map((c) => h('td', {}, c)),
              ),
            ),
          ),
        ),
      );
    }
    return wrap;

    function line(s) {
      return h(
        'div',
        { class: 'g-line' },
        h('span', { class: 'kw' }, s.kw),
        h('span', {}, s.text),
      );
    }
  }

  /* --------------------------------------- model-driven sequence diagrams */

  /* Participants and messages are projected from the scenario's ordered path
     through the behaviour graph — never from the Gherkin prose. */
  function projectSequence(sc, uc, lens) {
    const participantOf = (behaviourId) => {
      const b = byId.behaviour[behaviourId];
      if (!b) return { id: 'unknown', name: behaviourId };
      if (lens === 'technical') {
        const block = byId.block[b.blockId];
        return {
          id: block.id,
          name: block.name,
          kind: block.type,
          state: block.state,
        };
      }
      if (productAlias[b.blockId])
        return {
          id: b.blockId,
          name: productAlias[b.blockId],
          kind: 'external system',
        };
      const owningUc = b.useCaseId ? byId.useCase[b.useCaseId] : null;
      const svcId = owningUc ? owningUc.serviceId : b.blockId;
      const svc = byId.service[svcId];
      if (svc)
        return {
          id: svc.id,
          name: svc.name.replace(/Service$/, ''),
          kind: 'application service',
          state: svc.state,
        };
      const block = byId.block[b.blockId];
      const ctx = byId.context[block.contextId];
      return { id: ctx.id, name: ctx.name, kind: 'bounded context' };
    };

    const messages = [];
    const participants = [];
    const push = (p) => {
      if (!participants.some((x) => x.id === p.id)) participants.push(p);
      return p;
    };

    if (lens === 'product') {
      const humanActor = uc.actors
        .map((id) => byId.actor[id])
        .find((a) => a.kind === 'human');
      if (humanActor)
        push({
          id: humanActor.id,
          name: humanActor.name,
          kind: 'actor',
          state: humanActor.state,
        });
    }

    for (const lid of sc.path) {
      const l = byId.link[lid];
      if (!l) continue;
      const from = push(participantOf(l.from));
      const to = push(participantOf(l.to));
      if (from.id === to.id && lens === 'product') continue; // collapsed inside one participant
      messages.push({
        from,
        to,
        type: l.type,
        label: l.label || byId.behaviour[l.to].name,
        state: l.state,
      });
    }

    if (
      lens === 'product' &&
      participants.length &&
      participants[0].kind === 'actor' &&
      messages.length
    ) {
      messages.unshift({
        from: participants[0],
        to: messages[0].from,
        type: 'invokes',
        label: uc.name,
        state: 'existing',
      });
    }
    return { participants, messages };
  }

  function sequenceSvg(sc, uc, lens) {
    const { participants, messages } = projectSequence(sc, uc, lens);
    const colW = 168,
      padX = 20,
      headY = 44,
      rowH = 40;
    const w = padX * 2 + Math.max(1, participants.length) * colW;
    const hgt = headY + 26 + messages.length * rowH + 24;
    const x = (i) => padX + i * colW + colW / 2;
    const idx = (p) => participants.findIndex((q) => q.id === p.id);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(hgt));
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      `Sequence for ${sc.title} in the ${lens} lens`,
    );

    const mk = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text !== undefined) e.textContent = text;
      svg.appendChild(e);
      return e;
    };

    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `<marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor"/></marker>`;
    svg.appendChild(defs);

    participants.forEach((p, i) => {
      const cx = x(i);
      mk('rect', {
        x: cx - colW / 2 + 10,
        y: 8,
        width: colW - 20,
        height: 30,
        rx: 7,
        fill: 'var(--card)',
        stroke: p.state === 'new' ? 'var(--state-new)' : 'var(--border)',
        'stroke-dasharray': p.state === 'new' ? '4 3' : 'none',
      });
      mk(
        'text',
        {
          x: cx,
          y: 22,
          'text-anchor': 'middle',
          'font-size': '12',
          'font-weight': '600',
          fill: 'var(--card-foreground)',
        },
        p.name.length > 20 ? `${p.name.slice(0, 19)}…` : p.name,
      );
      mk(
        'text',
        {
          x: cx,
          y: 33,
          'text-anchor': 'middle',
          'font-size': '9.5',
          fill: 'var(--muted-foreground)',
        },
        p.kind,
      );
      mk('line', {
        x1: cx,
        y1: 40,
        x2: cx,
        y2: hgt - 14,
        stroke: 'var(--border)',
        'stroke-dasharray': '3 4',
      });
    });

    messages.forEach((m, i) => {
      const y = headY + 26 + i * rowH;
      const a = x(idx(m.from)),
        b = x(idx(m.to));
      const dir = b >= a ? 1 : -1;
      const colour =
        m.type === 'emits'
          ? 'var(--state-mod)'
          : m.type === 'returns'
            ? 'var(--muted-foreground)'
            : 'var(--primary)';
      if (a === b) {
        mk('path', {
          d: `M${a} ${y} h34 v18 h-34`,
          fill: 'none',
          stroke: colour,
          'marker-end': 'url(#arw)',
          color: colour,
          'stroke-width': '1.3',
        });
      } else {
        mk('line', {
          x1: a + dir * 4,
          y1: y,
          x2: b - dir * 6,
          y2: y,
          stroke: colour,
          color: colour,
          'stroke-width': '1.3',
          'marker-end': 'url(#arw)',
          'stroke-dasharray':
            m.type === 'returns' ? '3 3' : m.type === 'emits' ? '6 3' : 'none',
        });
      }
      const label =
        (m.type === 'emits' ? '⚡ ' : '') +
        m.label +
        (m.state === 'new'
          ? '  (new)'
          : m.state === 'modified'
            ? '  (modified)'
            : '');
      mk(
        'text',
        {
          x: (a + b) / 2,
          y: y - 6,
          'text-anchor': 'middle',
          'font-size': '11',
          fill: 'var(--secondary-foreground)',
        },
        label.length > 46 ? `${label.slice(0, 45)}…` : label,
      );
    });

    return svg;
  }

  function openSequence(sc, uc) {
    const bodyHost = h('div', {});
    const paint = () => {
      clear(bodyHost);
      bodyHost.append(
        h(
          'div',
          { class: 'seq-head' },
          h('strong', {}, sc.title),
          h(
            'span',
            { class: 'lens-note' },
            state.lens === 'product'
              ? 'Product lens — business participants'
              : 'Technical lens — services and building blocks',
          ),
        ),
        h('div', { class: 'seq' }, sequenceSvg(sc, uc, state.lens)),
        h(
          'div',
          { class: 'hint' },
          'Generated from the scenario’s ordered path through the behaviour graph. Switching lens re-projects the same path.',
        ),
      );
    };
    paint();
    const off = onChange(paint);
    modal({
      title: `Scenario sequence — ${uc.name}`,
      body: bodyHost,
      wide: true,
      footer: [
        h(
          'span',
          { class: 'note' },
          'Same model, two projections. Switch the lens in the top bar to compare.',
        ),
      ],
      onClose: off,
    });
  }

  /* ------------------------------------------------------------- comments */

  function renderComments(uc) {
    const wrap = h('div', {});
    for (const c of uc.comments) wrap.appendChild(commentThread(c));
    wrap.appendChild(composer(uc));
    return wrap; // the composer keeps this section non-empty even with no threads
  }

  function commentThread(c) {
    const el = h(
      'div',
      { class: `comment${c.resolved ? ' resolved' : ''}` },
      h(
        'div',
        { class: 'cm-head' },
        h('span', { class: 'who' }, initials(c.author)),
        h('span', { class: 'nm' }, c.author),
        h('span', { class: 'role' }, c.role),
        h('span', { class: 'time' }, c.time),
        h(
          'button',
          {
            class: 'btn sm ghost resolve',
            onclick: (e) => {
              el.classList.toggle('resolved');
              e.currentTarget.textContent = el.classList.contains('resolved')
                ? 'Reopen'
                : 'Resolve';
            },
          },
          c.resolved ? 'Reopen' : 'Resolve',
        ),
      ),
      h('div', { class: 'cm-body', html: linkifyMentions(c.body) }),
      (c.replies || []).map((r) =>
        h(
          'div',
          { class: 'cm-reply' },
          h(
            'div',
            { class: 'cm-head' },
            h('span', { class: 'who' }, initials(r.author)),
            h('span', { class: 'nm' }, r.author),
            h('span', { class: 'role' }, r.role),
            h('span', { class: 'time' }, r.time),
          ),
          h('div', { class: 'cm-body', html: linkifyMentions(r.body) }),
        ),
      ),
    );
    return el;
  }

  function initials(name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  function linkifyMentions(text) {
    return esc(text).replace(
      /@([A-Za-z]+)/g,
      '<span class="mention">@$1</span>',
    );
  }

  /* Comment composer with @mention autocomplete — people and agents use the
     same mechanism, per section 13. */
  function composer(uc) {
    const ta = h('textarea', {
      placeholder: 'Comment, or mention @agent to ask for a change…',
      'aria-label': 'New comment',
    });
    const menu = h('div', { class: 'mention-menu', hidden: true });
    const wrap = h(
      'div',
      { class: 'cm-compose' },
      ta,
      menu,
      h(
        'div',
        { style: { display: 'flex', gap: '6px', marginTop: '6px' } },
        h(
          'button',
          {
            class: 'btn primary sm',
            onclick: () => {
              const text = ta.value.trim();
              if (!text) return;
              const mentionsAgent = /@agent/i.test(text);
              const c = {
                id: `cm-${Math.random().toString(36).slice(2)}`,
                author: 'You',
                role: 'Product',
                time: 'just now',
                body: text,
                resolved: false,
                replies: [],
              };
              if (mentionsAgent) {
                c.replies.push({
                  author: 'Design agent',
                  role: 'Agent',
                  time: 'just now',
                  agent: true,
                  body: 'Working on it. Any change will arrive as a whole-document proposal you can accept or reject.',
                });
              }
              uc.comments.push(c);
              ta.value = '';
              emit();
              toast(
                mentionsAgent
                  ? 'Comment posted. The agent was mentioned and will answer with a proposal.'
                  : 'Comment posted for the whole team.',
              );
            },
          },
          'Comment',
        ),
        h(
          'span',
          { class: 'hint', style: { padding: '4px 0' } },
          'Type @ to mention a person or an agent',
        ),
      ),
    );

    ta.addEventListener('input', () => {
      const upto = ta.value.slice(0, ta.selectionStart);
      const m = /@(\w*)$/.exec(upto);
      if (!m) {
        menu.hidden = true;
        return;
      }
      const q = m[1].toLowerCase();
      const hits = S.mentionable.filter(
        (p) => p.label.toLowerCase().includes(q) || p.id.includes(q),
      );
      if (!hits.length) {
        menu.hidden = true;
        return;
      }
      clear(menu);
      for (const p of hits) {
        menu.appendChild(
          h(
            'button',
            {
              type: 'button',
              onclick: () => {
                ta.value =
                  ta.value.slice(0, ta.selectionStart - m[0].length) +
                  '@' +
                  (p.id === 'agent' ? 'agent' : p.label.split(' ')[0]) +
                  ' ' +
                  ta.value.slice(ta.selectionStart);
                menu.hidden = true;
                ta.focus();
              },
            },
            p.label,
            h('span', { class: 'hint' }, p.hint),
          ),
        );
      }
      menu.hidden = false;
      menu.style.left = '8px';
      menu.style.bottom = '52px';
    });
    ta.addEventListener('blur', () =>
      setTimeout(() => {
        menu.hidden = true;
      }, 150),
    );
    return wrap;
  }

  /* ------------------------------------------------------ proposal review */

  function openProposal() {
    const p = S.proposal;
    const col = (title, items, extra) =>
      h(
        'div',
        { class: 'impact-col' },
        h('h4', {}, `${title} (${items.length})`),
        h(
          'ul',
          {},
          items.map((i) =>
            h(
              'li',
              {},
              h('span', { class: 'kind' }, i.kind),
              h(
                'button',
                {
                  class: 'btn sm ghost',
                  style: { padding: '0', height: 'auto' },
                  onclick: () => {
                    closeModal();
                    if (byId.useCase[i.id]) select('useCase', i.id);
                  },
                },
                i.name,
              ),
              i.detail ? h('div', { class: 'kind' }, i.detail) : null,
            ),
          ),
        ),
        extra,
      );

    const body = h(
      'div',
      {},
      h('p', { style: { marginTop: 0 } }, p.summary),
      h(
        'div',
        { class: 'hint', style: { padding: '0 0 4px' } },
        `Raised by ${p.author}, ${p.createdAt}. Trigger: ${p.trigger}.`,
      ),
      h(
        'div',
        { class: 'impact-grid' },
        col('Added', p.impact.added),
        col('Changed', p.impact.changed),
        col('Removed', p.impact.removed),
      ),
      h(
        'div',
        { class: 'hint' },
        `Affects bounded contexts ${p.impact.contexts.join(', ')} and services ${p.impact.services.join(', ')}.`,
      ),
      h(
        'div',
        { class: 'impact-col', style: { marginTop: '10px' } },
        h(
          'h4',
          {},
          `Specification-only changes (${p.impact.specOnly.length}) — no codebase delta`,
        ),
        h(
          'ul',
          {},
          p.impact.specOnly.map((i) =>
            h(
              'li',
              {},
              h('span', { class: 'kind' }, i.kind),
              i.name,
              i.detail ? h('div', { class: 'kind' }, i.detail) : null,
            ),
          ),
        ),
      ),
      p.challenges.map((c) =>
        h(
          'div',
          { class: 'challenge' },
          h(
            'h4',
            {},
            `Challenges a decision made by ${c.author} — ${c.targetName}, ${c.field}`,
          ),
          h('div', { class: 'quote was' }, c.human),
          h('div', { class: 'quote' }, c.proposed),
          h(
            'p',
            { style: { margin: '8px 0 0', fontSize: '12.5px' } },
            h('strong', {}, 'Why: '),
            c.reason,
          ),
        ),
      ),
    );

    modal({
      title: `Pending proposal — ${p.title}`,
      chip: 'All-or-nothing review',
      body,
      wide: true,
      footer: [
        h(
          'button',
          {
            class: 'btn primary',
            onclick: () => {
              state.proposalReviewed = 'accepted';
              closeModal();
              emit();
              toast(
                'Proposal accepted as a whole. The accepted specification now includes every change above.',
              );
            },
          },
          'Accept proposal',
        ),
        h(
          'button',
          {
            class: 'btn',
            onclick: () => {
              closeModal();
              toast(
                'Proposal rejected. The accepted specification is unchanged.',
              );
            },
          },
          'Reject',
        ),
        h(
          'span',
          { class: 'note' },
          'Acceptance is whole-proposal; there is no field-by-field accept.',
        ),
      ],
    });
  }

  function openBaselineDiff(el) {
    modal({
      title: `${el.name} — differences from the scanned codebase`,
      body: h(
        'div',
        {},
        h(
          'div',
          { class: 'hint', style: { padding: '0 0 8px' } },
          `Baseline scan ${S.doc.baseline.scanId} of ${S.doc.baseline.repository}, ${S.doc.baseline.scannedAt}.`,
        ),
        h(
          'table',
          { class: 'fields' },
          h(
            'tbody',
            {},
            (el.baselineDiff || []).map((d) =>
              h(
                'tr',
                {},
                h('td', { class: 'fname' }, d.field),
                h('td', { class: 'fnote' }, d.from),
                h('td', { style: { width: '1%' } }, '→'),
                h('td', {}, d.to),
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'hint' },
          'Only baseline-comparable fields appear here. Description, rules prose, scenarios, quality attributes and comments never make an element Modified.',
        ),
      ),
      footer: [
        h(
          'span',
          { class: 'note' },
          'A marker always means: the source code must change here.',
        ),
      ],
    });
  }

  /* --------------------------------------------------------------- modal */

  let currentScrim = null;
  function modal(opts) {
    closeModal();
    const box = h(
      'div',
      {
        class: 'modal',
        role: 'dialog',
        'aria-modal': 'true',
        style: opts.wide ? { width: 'min(940px, 100%)' } : {},
      },
      h(
        'header',
        {},
        h('h2', {}, opts.title),
        opts.chip ? h('span', { class: 'chip' }, opts.chip) : null,
        h('span', { class: 'spacer', style: { flex: '1' } }),
        h(
          'button',
          { class: 'btn ghost', onclick: closeModal, 'aria-label': 'Close' },
          '✕',
        ),
      ),
      h('div', { class: 'modal-body' }, opts.body),
      h(
        'footer',
        {},
        opts.footer || [],
        h('span', { style: { flex: '1' } }),
        h('button', { class: 'btn ghost', onclick: closeModal }, 'Close'),
      ),
    );
    const scrim = h(
      'div',
      {
        class: 'scrim',
        onclick: (e) => {
          if (e.target === scrim) closeModal();
        },
      },
      box,
    );
    scrim._onClose = opts.onClose;
    document.body.appendChild(scrim);
    currentScrim = scrim;
    box.querySelector('.btn').focus();
  }
  function closeModal() {
    if (!currentScrim) return;
    if (currentScrim._onClose) currentScrim._onClose();
    currentScrim.remove();
    currentScrim = null;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  function openTasks() {
    modal({
      title: 'Stage 1 comparison tasks',
      body: h(
        'div',
        { class: 'tasks-panel' },
        h(
          'p',
          { style: { marginTop: 0 } },
          'Every prototype renders the same sample document and supports the same ten tasks.',
        ),
        h(
          'ol',
          {},
          [
            'Find a use case inside a bounded context and application service.',
            'Identify its Command, Query or Event type.',
            'Select an actor and see related use cases.',
            'Read and edit use-case details.',
            'Switch between Product and Technical lenses.',
            'Inspect acceptance scenarios.',
            'Open a scenario-specific sequence diagram.',
            'Reveal the selected use case’s supporting building-block neighbourhood.',
            'Add a comment mentioning a person or an agent.',
            'Understand that an agent proposal is pending and review its overall impact.',
          ].map((t) => h('li', {}, t)),
        ),
      ),
    });
  }

  let toastEl = null;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = h('div', { class: 'toast' }, msg);
    document.body.appendChild(toastEl);
    const mine = toastEl;
    setTimeout(() => {
      if (mine === toastEl) {
        mine.remove();
        toastEl = null;
      }
    }, 3600);
  }

  /* ------------------------------------------------------- canvas engine */

  /* Layout: actors in a lane on the left, then one column per bounded
     context holding its application-service groups. Positions are computed
     once and then owned by the user — dragging wins until Tidy up runs. */
  function computeLayout(_opts) {
    const NODE_W = 208,
      NODE_H = 52,
      GAP_X = 16,
      GAP_Y = 12;
    const nodes = {},
      groups = [];
    let y0 = 60;
    for (const a of S.actors) {
      nodes[a.id] = {
        id: a.id,
        kind: 'actor',
        x: 24,
        y: y0,
        w: 176,
        h: 40,
        data: a,
      };
      y0 += 52;
    }
    groups.push({
      id: 'actors',
      label: 'Actors',
      x: 8,
      y: 30,
      w: 208,
      h: y0 - 20,
      kind: 'lane',
    });

    let x = 252;
    let maxBottom = y0;
    for (const ctx of S.contexts) {
      let y = 60;
      const ctxStartY = y;
      for (const svc of ctx.services) {
        const list = useCasesByService[svc.id] || [];
        const cols = 2;
        const rows = Math.ceil(list.length / cols);
        const gw = cols * NODE_W + (cols - 1) * GAP_X + 28;
        const gh = rows * NODE_H + (rows - 1) * GAP_Y + 44;
        groups.push({
          id: svc.id,
          label: svc.name,
          x,
          y,
          w: gw,
          h: gh,
          kind: 'service',
          state: svc.state,
        });
        list.forEach((u, i) => {
          const c = i % cols,
            r = Math.floor(i / cols);
          nodes[u.id] = {
            id: u.id,
            kind: 'useCase',
            x: x + 14 + c * (NODE_W + GAP_X),
            y: y + 30 + r * (NODE_H + GAP_Y),
            w: NODE_W,
            h: NODE_H,
            data: u,
          };
        });
        y += gh + 26;
      }
      const cw = 2 * NODE_W + GAP_X + 28;
      groups.push({
        id: ctx.id,
        label: ctx.name,
        x: x - 14,
        y: ctxStartY - 26,
        w: cw + 28,
        h: y - ctxStartY + 22,
        kind: 'context',
        state: ctx.state,
      });
      maxBottom = Math.max(maxBottom, y);
      x += cw + 62;
    }
    return {
      nodes,
      groups,
      width: x + 40,
      height: maxBottom + 60,
      NODE_W,
      NODE_H,
    };
  }

  /* Contextual neighbourhood: which building blocks surround a selected use
     case. The Product lens shows only actors and other use cases. */
  function neighbourhoodBlocks(uc) {
    if (state.lens === 'product') return [];
    return (uc.blocks || []).filter(
      (id) => byId.block[id] && byId.block[id].type !== 'application service',
    );
  }

  function relatedLinks(uc) {
    const b = behaviourByUseCase[uc.id];
    if (!b) return [];
    return S.links.filter((l) => l.from === b.id || l.to === b.id);
  }

  function buildCanvas(host, opts) {
    opts = opts || {};
    const layout = computeLayout();
    const stage = h('div', { class: 'canvas-stage' });
    const wires = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wires.setAttribute('class', 'wires');
    stage.appendChild(wires);

    const wrap = h(
      'div',
      { class: 'canvas-wrap' },
      stage,
      h(
        'div',
        { class: 'canvas-toolbar' },
        h(
          'button',
          {
            class: 'btn sm ghost',
            onclick: () => zoomBy(-0.15),
            title: 'Zoom out',
          },
          '−',
        ),
        h(
          'button',
          {
            class: 'btn sm ghost',
            onclick: () => zoomBy(0.15),
            title: 'Zoom in',
          },
          '+',
        ),
        h(
          'button',
          {
            class: 'btn sm ghost',
            onclick: () => {
              view.k = 1;
              view.x = 0;
              view.y = 0;
              applyView();
            },
            title: 'Reset zoom',
          },
          '⤢',
        ),
        h(
          'button',
          {
            class: 'btn sm',
            title: 'Restore a readable automatic arrangement',
            onclick: () => {
              Object.assign(layout, computeLayout());
              moved.clear();
              paint();
              toast('Tidied up. Manual positions were reset.');
            },
          },
          'Tidy up',
        ),
      ),
      h(
        'div',
        { class: 'canvas-legend' },
        h('span', {}, 'Codebase delta:'),
        marker('new'),
        marker('modified'),
        marker('removed'),
        h('span', {}, '· Existing elements are unmarked'),
        h('span', {}, '· Relationships appear on selection'),
      ),
    );
    host.appendChild(wrap);

    const view = { k: opts.initialZoom || 1, x: 0, y: 0 };
    const moved = new Map();
    const nodeEls = new Map();

    function applyView() {
      stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
      if (opts.onZoom) opts.onZoom(view.k);
    }
    function zoomBy(d, cx, cy) {
      const k = Math.min(2.4, Math.max(0.35, view.k + d));
      if (cx !== undefined) {
        const r = wrap.getBoundingClientRect();
        const px = (cx - r.left - view.x) / view.k,
          py = (cy - r.top - view.y) / view.k;
        view.x -= px * (k - view.k);
        view.y -= py * (k - view.k);
      }
      view.k = k;
      applyView();
    }

    wrap.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey && !e.metaKey && !opts.wheelZoom) return;
        e.preventDefault();
        zoomBy(-e.deltaY * 0.002, e.clientX, e.clientY);
      },
      { passive: false },
    );

    /* Trackpad panning on empty canvas. */
    let panning = null;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.node') || e.target.closest('.canvas-toolbar'))
        return;
      panning = { x: e.clientX - view.x, y: e.clientY - view.y };
      wrap.setPointerCapture(e.pointerId);
      if (e.target === wrap || e.target === stage) select(null, null);
    });
    wrap.addEventListener('pointermove', (e) => {
      if (!panning) return;
      view.x = e.clientX - panning.x;
      view.y = e.clientY - panning.y;
      applyView();
    });
    wrap.addEventListener('pointerup', () => {
      panning = null;
    });

    function nodePos(id) {
      const m = moved.get(id);
      const n = layout.nodes[id];
      if (!n) return null;
      return { ...n, x: m ? m.x : n.x, y: m ? m.y : n.y };
    }

    function paint() {
      clear(stage);
      stage.appendChild(wires);
      clear(wires);
      stage.style.width = `${layout.width}px`;
      stage.style.height = `${layout.height}px`;

      for (const g of layout.groups) {
        stage.appendChild(
          h(
            'div',
            {
              class: `group ${g.kind === 'service' ? 'service' : ''}`,
              style: {
                left: `${g.x}px`,
                top: `${g.y}px`,
                width: `${g.w}px`,
                height: `${g.h}px`,
              },
            },
            h(
              'span',
              { class: 'group-label' },
              g.label,
              g.state === 'new' ? ' · New' : '',
            ),
          ),
        );
      }

      const sel = state.selection;
      const selUc = sel && sel.kind === 'useCase' ? byId.useCase[sel.id] : null;
      const selActor = sel && sel.kind === 'actor' ? byId.actor[sel.id] : null;
      const focusSet = new Set();
      if (selUc) {
        focusSet.add(selUc.id);
        for (const a of selUc.actors) focusSet.add(a);
        for (const l of relatedLinks(selUc)) {
          for (const bid of [l.from, l.to]) {
            const b = byId.behaviour[bid];
            if (b?.useCaseId) focusSet.add(b.useCaseId);
          }
        }
      } else if (selActor) {
        focusSet.add(selActor.id);
        for (const u of S.useCases)
          if (u.actors.includes(selActor.id)) focusSet.add(u.id);
      }

      nodeEls.clear();
      for (const id of Object.keys(layout.nodes)) {
        const n = nodePos(id);
        const dim = focusSet.size && !focusSet.has(id);
        const el = n.kind === 'actor' ? actorNode(n) : useCaseNode(n);
        el.classList.toggle('dim', !!dim);
        el.style.left = `${n.x}px`;
        el.style.top = `${n.y}px`;
        el.style.width = `${n.w}px`;
        el.setAttribute('aria-current', String(!!sel && sel.id === id));
        makeDraggable(el, id);
        stage.appendChild(el);
        nodeEls.set(id, el);
      }

      /* Contextual neighbourhood: building blocks appear only for the
         selected use case, and only in the Technical lens. */
      const extra = [];
      if (selUc) {
        const blocks = neighbourhoodBlocks(selUc);
        /* The neighbourhood unfolds in a band under the owning bounded
           context: close enough to read as local, clear of the use-case grid
           so nothing is hidden behind it. */
        const ctxGroup = layout.groups.find(
          (g) => g.kind === 'context' && g.id === selUc.contextId,
        );
        const BW = 172,
          BH = 46,
          BGAP = 12;
        const perRow = Math.max(1, Math.floor((ctxGroup.w - 20) / (BW + BGAP)));
        const rows = Math.ceil(blocks.length / perRow);
        const bandX = ctxGroup.x + 10;
        const bandY = ctxGroup.y + ctxGroup.h + 34;

        if (blocks.length) {
          stage.appendChild(
            h(
              'div',
              {
                class: 'group',
                style: {
                  left: `${bandX - 12}px`,
                  top: `${bandY - 22}px`,
                  width: `${Math.min(blocks.length, perRow) * (BW + BGAP) + 12}px`,
                  height: `${rows * (BH + BGAP) + 28}px`,
                },
              },
              h(
                'span',
                { class: 'group-label' },
                `Neighbourhood of ${selUc.name}`,
              ),
            ),
          );
          stage.style.height = `${Math.max(layout.height, bandY + rows * (BH + BGAP) + 50)}px`;
        }

        blocks.forEach((bid, i) => {
          const b = byId.block[bid];
          const bx = bandX + (i % perRow) * (BW + BGAP);
          const by = bandY + Math.floor(i / perRow) * (BH + BGAP);
          const el = h(
            'button',
            {
              class: 'node block',
              dataset: { state: b.state, id: b.id },
              style: { left: `${bx}px`, top: `${by}px`, width: `${BW}px` },
              onclick: (e) => {
                e.stopPropagation();
                select('block', b.id);
              },
            },
            h('span', { class: 'node-name' }, b.name),
            h(
              'span',
              { class: 'node-meta' },
              h('span', { class: 'kind-chip' }, b.type),
              marker(b.state),
            ),
          );
          stage.appendChild(el);
          extra.push({ id: b.id, x: bx, y: by, w: BW, h: BH });
        });
      }

      drawWires(selUc, selActor, extra);
    }

    function useCaseNode(n) {
      const u = n.data;
      return h(
        'button',
        {
          class: 'node',
          dataset: { state: u.state, id: u.id },
          type: 'button',
          onclick: (e) => {
            e.stopPropagation();
            (opts.onSelect || ((id) => select('useCase', id)))(u.id);
          },
          ondblclick: (e) => {
            e.stopPropagation();
            opts.onOpen?.(u.id);
          },
          title: u.summary,
        },
        h('span', { class: 'node-name' }, u.name),
        h('span', { class: 'node-meta' }, typeBadge(u.type), marker(u.state)),
      );
    }

    function actorNode(n) {
      const a = n.data;
      return h(
        'button',
        {
          class: 'node actor',
          dataset: { state: a.state, id: a.id },
          type: 'button',
          title: a.description,
          onclick: (e) => {
            e.stopPropagation();
            select('actor', a.id);
          },
        },
        h(
          'span',
          { class: 'node-name' },
          (a.kind === 'human' ? '☻ ' : '▤ ') + a.name,
        ),
        a.state !== 'existing'
          ? h('span', { class: 'node-meta' }, marker(a.state))
          : null,
      );
    }

    function makeDraggable(el, id) {
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const start = nodePos(id);
        const ox = e.clientX,
          oy = e.clientY;
        let dragged = false;
        const move = (ev) => {
          const dx = (ev.clientX - ox) / view.k,
            dy = (ev.clientY - oy) / view.k;
          if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
          if (!dragged) return;
          moved.set(id, { x: start.x + dx, y: start.y + dy });
          el.style.left = `${start.x + dx}px`;
          el.style.top = `${start.y + dy}px`;
          drawWires(
            state.selection && state.selection.kind === 'useCase'
              ? byId.useCase[state.selection.id]
              : null,
            state.selection && state.selection.kind === 'actor'
              ? byId.actor[state.selection.id]
              : null,
            [],
          );
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (dragged) {
            paint();
            toast('Position kept. Tidy up restores the automatic arrangement.');
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });
    }

    /* Relationships are hidden until something is selected. */
    function drawWires(selUc, selActor, extraNodes) {
      clear(wires);
      wires.setAttribute('width', layout.width);
      wires.setAttribute('height', layout.height);
      const pos = (id) => {
        const e = (extraNodes || []).find((x) => x.id === id);
        if (e) return { cx: e.x + e.w / 2, cy: e.y + e.h / 2 };
        const n = nodePos(id);
        return n ? { cx: n.x + n.w / 2, cy: n.y + n.h / 2 } : null;
      };
      const line = (a, b, cls, label) => {
        if (!a || !b) return;
        const p = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'path',
        );
        const mx = (a.cx + b.cx) / 2;
        p.setAttribute(
          'd',
          `M${a.cx} ${a.cy} C ${mx} ${a.cy} ${mx} ${b.cy} ${b.cx} ${b.cy}`,
        );
        p.setAttribute('class', cls);
        wires.appendChild(p);
        if (label) {
          const t = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'text',
          );
          t.setAttribute('x', String(mx));
          t.setAttribute('y', String((a.cy + b.cy) / 2 - 4));
          t.setAttribute('text-anchor', 'middle');
          t.textContent = label;
          wires.appendChild(t);
        }
      };

      if (selUc) {
        for (const aid of selUc.actors)
          line(pos(aid), pos(selUc.id), 'actor-link');
        for (const l of relatedLinks(selUc)) {
          const fb = byId.behaviour[l.from],
            tb = byId.behaviour[l.to];
          const fromId = fb?.useCaseId ? fb.useCaseId : fb?.blockId;
          const toId = tb?.useCaseId ? tb.useCaseId : tb?.blockId;
          line(pos(fromId), pos(toId), l.type, l.type);
        }
        if (state.lens === 'technical') {
          for (const bid of neighbourhoodBlocks(selUc))
            line(pos(selUc.id), pos(bid), 'block-link');
        }
      } else if (selActor) {
        for (const u of S.useCases)
          if (u.actors.includes(selActor.id))
            line(pos(selActor.id), pos(u.id), 'actor-link');
      }
    }

    paint();
    onChange(paint);
    applyView();

    /* Fit the whole behaviour map on first paint so a first-time reader sees
       every bounded context before touching zoom. */
    function fit() {
      const r = wrap.getBoundingClientRect();
      if (!r.width) return;
      view.k = Math.min(1, Math.max(0.4, (r.width - 24) / layout.width));
      view.x = 8;
      view.y = 4;
      applyView();
    }
    if (opts.fit) requestAnimationFrame(fit);

    return {
      paint,
      wrap,
      view,
      zoomBy,
      applyView,
      fit,
      focusOn(id, k) {
        const n = nodePos(id);
        if (!n) return;
        const r = wrap.getBoundingClientRect();
        view.k = k || 1.6;
        view.x = r.width / 2 - (n.x + n.w / 2) * view.k;
        view.y = r.height / 2 - (n.y + n.h / 2) * view.k;
        applyView();
      },
    };
  }

  /* ---------------------------------------------------------------- misc */

  function useCaseCrumb(uc) {
    const svc = byId.service[uc.serviceId];
    return `${byId.context[uc.contextId].name} → ${svc.name}`;
  }

  global.DD = {
    S,
    byId,
    state,
    h,
    clear,
    marker,
    typeBadge,
    setLens,
    select,
    onChange,
    emit,
    renderTopbar,
    renderCatalogue,
    renderUseCaseDoc,
    renderScenario,
    sequenceSvg,
    openSequence,
    openProposal,
    openBaselineDiff,
    buildCanvas,
    modal,
    closeModal,
    toast,
    useCaseCrumb,
    useCasesByService,
    neighbourhoodBlocks,
    SECTIONS,
    TECHNICAL_ONLY,
  };
})(window);
