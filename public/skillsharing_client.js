///Managing State and Actions

function talkURL(title) {
  return "talks/" + encodeURIComponent(title);
}

function fetchOK(url, options) {
  return fetch(url, options).then((response) => {
    if (response.status < 400) return response;
    else throw new Error(response.statusText);
  });
}

function reportError(err) {
  console.log(err);
  return alert(String(err));
}

function handleAction(state, action) {
  if (action.type == "SET_USER") {
    sessionStorage.setItem("userName", action.user);
    return Object.assign({}, state, { user: action.user });
  } else if (action.type == "SET_TALKS") {
    return Object.assign({}, state, { talks: action.talks });
  } else if (action.type == "NEW_TALK") {
    console.log("state", state);
    fetchOK(talkURL(action.title), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presenter: state.user, summary: action.summary }),
    }).catch(reportError);
  } else if (action.type == "DELETE_TALK") {
    console.log("delte", action);
    fetchOK(talkURL(action.talk), { method: "DELETE" }).catch(reportError);
  } else if (action.type == "NEW_COMMENT") {
    fetchOK(talkURL(action.talk) + "/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: state.user,
        message: action.message,
      }),
    }).catch(reportError);
  }

  return state;
}

///Rendering Components
function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);

  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }

  return dom;
}

function renderUserField(name, dispatch) {
  console.log("name", name);
  return elt(
    "label",
    {},
    "Your Name:",
    elt("input", {
      type: "text",
      value: name,
      onchange: (event) => {
        console.log("ev", event.target.value);
        dispatch({ type: "SET_USER", user: event.target.value });
      },
    })
  );
}

function renderTalk(talk, dispatch) {
  // console.log("talk", talk);
  const { title, presenter, summary, comments } = talk || {};
  return elt(
    "section",
    { className: "talk" },
    elt(
      "h2",
      null,
      title,
      " ",
      elt(
        "button",
        {
          type: "button",
          onclick() {
            dispatch({ type: "DELETE_TALK", talk: title });
          },
        },
        "Delete"
      )
    ),
    elt("div", null, "by ", elt("strong", null, presenter)),
    elt("p", null, summary),
    ...comments.map(renderComment),
    elt(
      "form",
      {
        onsubmit(event) {
          event.preventDefault();
          let form = event.target;
          dispatch({
            type: "NEW_COMMENT",
            talk: talk.title,
            message: form.elements.comment.value,
          });
          form.reset();
        },
      },
      elt("input", { type: "text", name: "comment" }),
      " ",
      elt("button", { type: "submit" }, "Add Comment")
    )
  );
}

function renderComment(comment) {
  return elt(
    "p",
    { className: "comment" },
    elt("strong", null, comment.author),
    ":",
    comment.message
  );
}

function renderTalkForm(dispatch) {
  let title = elt("input", { type: "text" });
  let summary = elt("input", { type: "text" });

  return elt(
    "form",
    {
      onsubmit(event) {
        event.preventDefault();
        dispatch({
          type: "NEW_TALK",
          title: title.value,
          summary: summary.value,
        });
        event.target.reset();
      },
    },
    elt("h3", null, "Submit a Talk"),
    elt("label", null, "Title: ", title),
    elt("label", null, "Summary", summary),
    elt("button", { type: "submit" }, "Submit")
  );
}

async function pollTalks(update) {
  let tag = undefined;
  for (;;) {
    let response;
    try {
      response = await fetchOK("/talks", {
        headers: tag && { "If-None-Match": tag, "Prefer": "wait=90" },
      });
    } catch (e) {
      console.log("Request failed: " + e);
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    if (response.status == 304) continue;
    console.log("head", response.headers);
    tag = response.headers.get("ETag");
    console.log("tag", tag);
    update(await response.json());
  }
}

class SkillShareApp {
  constructor(state, dispatch) {
    console.log("state in cons", state);
    this.dispatch = dispatch;
    this.talks = [];
    this.talkDOM = elt("div", { className: "talks" });
    this.dom = elt(
      "div",
      null,
      renderUserField(state.user, dispatch),
      this.talkDOM,
      renderTalkForm(dispatch)
    );
    this.syncState(state);
  }

  syncState(state) {
    console.log("state, this", state, this);
    if (state.talks != this.talks) {
      this.talkDOM.textContent = "";

      for (let talk of state.talks) {
        this.talkDOM.appendChild(renderTalk(talk, this.dispatch));
      }
      this.talks = state.talks;
    }
  }
}

function runApp() {
  let user = sessionStorage.getItem("userName") || "Anon";
  let state, app;

  function dispatch(action) {
    state = handleAction(state, action);
    app.syncState(state);
  }
  pollTalks((talks) => {
    console.log("talks", talks);
    if (!app) {
      state = { user, talks };
      app = new SkillShareApp(state, dispatch);
      document.body.appendChild(app.dom);
    } else {
      dispatch({ type: "SET_TALKS", talks });
    }
  }).catch(reportError);
}

runApp();
