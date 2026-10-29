(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const controls = {
    search: $("search"),
    clearSearch: $("clear-search"),
    programme: $("programme"),
    department: $("department"),
    year: $("academic-year"),
    version: $("syllabus-version")
  };
  const results = $("catalogue-results");
  const summary = $("results-summary");
  const pagination = $("pagination");
  const previous = $("previous-page");
  const next = $("next-page");
  const pageLabel = $("page-label");
  const pageStatus = $("page-status");
  const PAGE_SIZE = 12;
  let records = [];
  let metadata = {};
  let page = 1;

  const normalize = value => String(value ?? "").toLocaleLowerCase().trim();
  const escapeText = value => String(value ?? "-");
  const uniqueSorted = values => [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const yearLabel = year => {
    const labels = { "1": "1st Year", "2": "2nd Year", "3": "3rd Year", "4": "4th Year" };
    return labels[String(year)] || String(year || "-");
  };
  const programmeLabel = key => metadata.programmes?.[key]?.label || key || "Programme";
  const versionLabel = (programme, version) => {
    const item = (metadata.programmes?.[programme]?.syllabusVersions || []).find(v => String(v.value) === String(version));
    return item?.label || version || "-";
  };
  const matchingEntries = (omit = "") => {
    const selected = {
      programme: controls.programme.value,
      department: controls.department.value,
      year: controls.year.value,
      version: controls.version.value
    };
    return records.filter(record =>
      (omit === "programme" || !selected.programme || record.programme === selected.programme) &&
      (omit === "department" || !selected.department || record.department === selected.department) &&
      (omit === "year" || !selected.year || String(record.year) === selected.year) &&
      (omit === "version" || !selected.version || String(record.syllabusVersion) === selected.version)
    );
  };
  const setSelect = (select, placeholder, options, selectedValue) => {
    select.replaceChildren(new Option(placeholder, ""));
    options.forEach(option => select.add(new Option(option.label, option.value)));
    select.value = options.some(option => String(option.value) === String(selectedValue)) ? String(selectedValue) : "";
  };
  const optionObjects = (values, labeler = value => value) => uniqueSorted(values).map(value => ({ value, label: labeler(value) }));

  function refreshFilters(changed) {
    if (changed === "programme") {
      controls.department.value = "";
      controls.year.value = "";
      controls.version.value = "";
    } else if (changed === "department") {
      controls.year.value = "";
      controls.version.value = "";
    } else if (changed === "year") {
      controls.version.value = "";
    }

    const programmeOptions = Object.keys(metadata.programmes || {}).map(key => ({ value: key, label: programmeLabel(key) }));
    const selectedProgramme = controls.programme.value;
    setSelect(controls.programme, "All degree types", programmeOptions, selectedProgramme);

    const departments = optionObjects(matchingEntries("department").map(record => record.department), value => value);
    const selectedDepartment = controls.department.value;
    setSelect(controls.department, "All departments", departments, selectedDepartment);

    const years = optionObjects(matchingEntries("year").map(record => record.year), value => yearLabel(value));
    const selectedYear = controls.year.value;
    setSelect(controls.year, "All years", years, selectedYear);

    const versions = optionObjects(matchingEntries("version").map(record => record.syllabusVersion), value => versionLabel(selectedProgramme, value));
    const selectedVersion = controls.version.value;
    setSelect(controls.version, "All versions", versions, selectedVersion);
  }

  function textForCourse(course, record) {
    return normalize([
      course.code, course.name, course.title, course.optionGroup, course.package,
      record.department, record.programme, programmeLabel(record.programme),
      record.yearLabel, record.syllabusVersion, record.sourceLabel
    ].join(" "));
  }

  function filteredResults() {
    const query = normalize(controls.search.value);
    const filtered = [];
    matchingEntries().forEach(record => {
      const courseList = Array.isArray(record.courses) ? record.courses : [];
      const recordText = normalize([
        record.department, record.programme, programmeLabel(record.programme),
        record.yearLabel, record.syllabusVersion, versionLabel(record.programme, record.syllabusVersion),
        record.sourceLabel, record.sourceUrl, record.departmentCategory
      ].join(" "));
      const recordMatches = !query || recordText.includes(query);
      const matches = query && !recordMatches
        ? courseList.filter(course => textForCourse(course, record).includes(query))
        : courseList;
      if (recordMatches || matches.length || (!query && courseList.length === 0)) {
        filtered.push({ record, courses: matches });
      }
    });
    return filtered;
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function makeCourseTable(courses) {
    const wrapper = make("div", "course-table-wrap");
    const table = make("table", "course-table");
    const head = make("thead");
    const headerRow = make("tr");
    ["Course / subject", "Code", "Credits", "Package"].forEach(label => headerRow.appendChild(make("th", "", label)));
    head.appendChild(headerRow);
    const body = make("tbody");
    courses.forEach(course => {
      const row = make("tr");
      row.appendChild(make("td", "course-name", course.name || course.title || "Untitled course"));
      row.appendChild(make("td", "course-code", course.code || "-"));
      const credit = course.nonCredit ? "Non-credit" : (course.credits === 0 || course.credits ? String(course.credits) : "-");
      row.appendChild(make("td", "course-credit", credit));
      const packageName = course.optionGroupLabel || course.packageLabel || course.optionGroup || course.package || "-";
      const packageCell = make("td");
      if (packageName !== "-") packageCell.appendChild(make("span", "package-chip", packageName));
      else packageCell.textContent = "-";
      row.appendChild(packageCell);
      body.appendChild(row);
    });
    table.append(head, body);
    wrapper.appendChild(table);
    return wrapper;
  }

  function makeCard(item) {
    const record = item.record;
    const card = make("article", "syllabus-card");
    const header = make("div", "syllabus-card-head");
    const copy = make("div");
    copy.appendChild(make("h4", "", record.department || "Department"));
    const chips = make("div", "card-meta");
    [
      programmeLabel(record.programme),
      record.yearLabel || yearLabel(record.year),
      versionLabel(record.programme, record.syllabusVersion)
    ].forEach(value => chips.appendChild(make("span", "meta-chip", value)));
    copy.appendChild(chips);

    const source = make("div", "card-source");
    if (record.sourceLabel) source.appendChild(document.createTextNode(record.sourceLabel + " "));
    if (record.sourceUrl) {
      const link = make("a", "", "View source");
      link.href = record.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      source.appendChild(link);
    }
    if (source.childNodes.length) copy.appendChild(source);

    const badge = make("span", "verify-badge" + (record.verified ? " verified" : ""), record.verified ? "Verified" : "Not independently verified");
    header.append(copy, badge);
    card.appendChild(header);

    if (item.courses.length) {
      card.appendChild(makeCourseTable(item.courses));
      const credits = item.courses.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
      const foot = make("div", "card-foot");
      foot.append(
        make("span", "", item.courses.length + " course " + (item.courses.length === 1 ? "entry" : "entries")),
        make("span", "", credits ? credits + " listed credits" : "Credits not listed")
      );
      card.appendChild(foot);
    } else {
      card.appendChild(make("div", "empty-entry", "This syllabus slot is present in the catalogue, but no course list has been collected for it yet."));
    }

    if (record.verificationNote) card.appendChild(make("div", "verification-note", record.verificationNote));
    return card;
  }

  function render() {
    const filtered = filteredResults();
    const total = filtered.length;
    const courseCount = filtered.reduce((sum, item) => sum + item.courses.length, 0);
    const emptyCount = filtered.filter(item => item.courses.length === 0).length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(page, 1), pageCount);
    const start = (page - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);

    results.replaceChildren();
    if (!total) {
      const empty = make("div", "no-results");
      empty.append(make("strong", "", "No matching syllabus lists"), make("span", "", "Try a different search or clear one of the filters."));
      results.appendChild(empty);
    } else {
      visible.forEach(item => results.appendChild(makeCard(item)));
    }

    summary.textContent = total + " syllabus " + (total === 1 ? "list" : "lists") + " · " +
      courseCount.toLocaleString() + " matching course " + (courseCount === 1 ? "entry" : "entries") +
      (emptyCount ? " · " + emptyCount + " lists have no course rows" : "");
    pageStatus.textContent = total ? "Showing " + (start + 1) + "-" + Math.min(start + PAGE_SIZE, total) + " of " + total : "";
    pagination.hidden = pageCount <= 1;
    previous.disabled = page <= 1;
    next.disabled = page >= pageCount;
    pageLabel.textContent = "Page " + page + " of " + pageCount;
  }

  function updateStats() {
    const populated = records.filter(record => record.courses.length);
    const courses = populated.reduce((sum, record) => sum + record.courses.length, 0);
    const departments = new Set(populated.map(record => record.department));
    $("stat-courses").textContent = courses.toLocaleString();
    $("stat-lists").textContent = populated.length.toLocaleString();
    $("stat-departments").textContent = departments.size.toLocaleString();
    $("stat-programmes").textContent = new Set(populated.map(record => record.programme)).size.toLocaleString();
  }

  function bind() {
    controls.programme.addEventListener("change", () => { refreshFilters("programme"); page = 1; render(); });
    controls.department.addEventListener("change", () => { refreshFilters("department"); page = 1; render(); });
    controls.year.addEventListener("change", () => { refreshFilters("year"); page = 1; render(); });
    controls.version.addEventListener("change", () => { refreshFilters("version"); page = 1; render(); });
    controls.search.addEventListener("input", () => {
      controls.clearSearch.hidden = !controls.search.value;
      page = 1;
      render();
    });
    controls.clearSearch.addEventListener("click", () => {
      controls.search.value = "";
      controls.clearSearch.hidden = true;
      page = 1;
      render();
      controls.search.focus();
    });
    $("reset-filters").addEventListener("click", () => {
      controls.search.value = "";
      controls.clearSearch.hidden = true;
      controls.programme.value = "";
      controls.department.value = "";
      controls.year.value = "";
      controls.version.value = "";
      refreshFilters("reset");
      page = 1;
      render();
    });
    previous.addEventListener("click", () => { page--; render(); $("catalogue").scrollIntoView({ behavior: "smooth" }); });
    next.addEventListener("click", () => { page++; render(); $("catalogue").scrollIntoView({ behavior: "smooth" }); });
  }

  fetch("./syllabus.json", { cache: "no-cache" })
    .then(response => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(data => {
      metadata = data || {};
      records = Object.entries(metadata.syllabuses || {}).map(([key, value]) => {
        const entry = value || {};
        const [keyProgramme, keyVersion, keyDepartment, keyYear] = key.split("|");
        return {
          ...entry,
          programme: entry.programme || keyProgramme,
          syllabusVersion: entry.syllabusVersion || keyVersion,
          department: entry.department || keyDepartment,
          year: entry.year || keyYear,
          yearLabel: entry.yearLabel || yearLabel(entry.year || keyYear),
          courses: Array.isArray(entry.courses) ? entry.courses : []
        };
      }).sort((a, b) =>
        programmeLabel(a.programme).localeCompare(programmeLabel(b.programme)) ||
        String(a.department).localeCompare(String(b.department)) ||
        Number(a.year) - Number(b.year)
      );
      updateStats();
      refreshFilters();
      bind();
      render();
    })
    .catch(() => {
      $("load-error").hidden = false;
      $("results-summary").textContent = "Could not load the syllabus catalogue.";
      $("catalogue-results").replaceChildren();
    });
})();