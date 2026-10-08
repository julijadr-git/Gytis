import { useCallback, useEffect, useState } from "react";
import TaskList from "./TaskList";
import ProgressBar from "./ProgressBar";
import Navbar from "./Navbar";
import AddTaskForm from "./AddTaskForm";
import Profile from "./Profile";
import Weather from "./Weather";
import "./App.css";

const TASKS_API_URL = "https://testapi.io/api/julijadr-git/resource/tasklist";
const USERS_API_URL = "https://testapi.io/api/julijadr-git/resource/reg";
const SESSION_STORAGE_KEY = "flowly-user";

function getSavedUsername() {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function normalizeTask(task) {
  return {
    ...task,
    title: task.title || "",
    status: task.status || "Nepradėta",
    deadline: task.deadline || "",
  };
}

function getApiErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function App() {
  const [savedUsername, setSavedUsername] = useState(getSavedUsername);
  const [user, setUser] = useState({
    name: savedUsername || "Jonas Jonaitis",
    email: "jonas@flowly.lt",
  });

  const [activePage, setActivePage] = useState("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(savedUsername));
  const [loginError, setLoginError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(TASKS_API_URL);
      if (!response.ok) throw new Error(`Serverio klaida (${response.status}).`);

      const data = await response.json();
      const taskList = Array.isArray(data) ? data : data?.data;
      if (!Array.isArray(taskList)) throw new Error("API grąžino netinkamo formato užduotis.");

      setTasks(taskList.map(normalizeTask));
      setTasksError("");
    } catch (error) {
      setTasksError(getApiErrorMessage(error, "Nepavyko įkelti užduočių iš API."));
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchTasks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchTasks]);

  const loadTasks = useCallback(() => {
    setTasksError("");
    return fetchTasks();
  }, [fetchTasks]);

  async function handleSubmit(event) {
    event.preventDefault();
    const username = email.trim();
    setAuthLoading(true);
    setLoginError("");
    setAuthMessage("");

    try {
      if (isRegistering) {
        const listResponse = await fetch(USERS_API_URL);
        if (!listResponse.ok) throw new Error(`Nepavyko patikrinti vartotojų (${listResponse.status}).`);
        const listData = await listResponse.json();
        const users = Array.isArray(listData) ? listData : listData?.data;
        if (!Array.isArray(users)) throw new Error("API grąžino netinkamo formato vartotojų sąrašą.");

        const alreadyExists = users.some((entry) =>
          String(entry.user || "").toLowerCase() === username.toLowerCase(),
        );
        if (alreadyExists) {
          setLoginError("Šis vartotojo vardas jau užimtas.");
          return;
        }

        const response = await fetch(USERS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: username, password }),
        });
        if (!response.ok) throw new Error(`Registracija nepavyko (${response.status}).`);

        setAuthMessage("Registracija sėkminga. Dabar galite prisijungti.");
        setIsRegistering(false);
        setPassword("");
        return;
      }

      const response = await fetch(USERS_API_URL);
      if (!response.ok) throw new Error(`Nepavyko patikrinti prisijungimo (${response.status}).`);
      const data = await response.json();
      const users = Array.isArray(data) ? data : data?.data;
      if (!Array.isArray(users)) throw new Error("API grąžino netinkamo formato vartotojų sąrašą.");

      const matchedUser = users.find((entry) =>
        String(entry.user || "").toLowerCase() === username.toLowerCase() &&
        entry.password === password,
      );

      if (!matchedUser) {
        setLoginError("Neteisingas vartotojo vardas arba slaptažodis.");
        return;
      }

      setUser((currentUser) => ({ ...currentUser, name: matchedUser.user }));
      try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, matchedUser.user);
        setSavedUsername(matchedUser.user);
      } catch {
        setLoginError("Nepavyko išsaugoti prisijungimo šiame įrenginyje.");
        return;
      }
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(getApiErrorMessage(error, "Nepavyko prisijungti prie vartotojų API."));
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Atsijungimas tęsiasi ir jei naršyklė neleidžia naudoti vietinės saugyklos.
    }
    setSavedUsername("");
    setIsLoggedIn(false);
    setActivePage("home");
    setEmail("");
    setPassword("");
    setLoginError("");
    setAuthMessage("");
  }

  async function handleAddTask(newTask) {
    setTasksError("");

    try {
      const response = await fetch(TASKS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          status: newTask.status,
          deadline: newTask.deadline,
          user: savedUsername,
        }),
      });
      if (!response.ok) throw new Error(`Nepavyko išsaugoti užduoties (${response.status}).`);

      const data = await response.json().catch(() => null);
      const savedTask = data?.data || data;
      if (savedTask && typeof savedTask === "object" && savedTask.id != null) {
        setTasks((currentTasks) => [
          ...currentTasks,
          normalizeTask({ ...savedTask, user: savedTask.user || savedUsername }),
        ]);
      } else {
        await loadTasks();
      }
    } catch (error) {
      setTasksError(getApiErrorMessage(error, "Nepavyko išsaugoti užduoties."));
      throw error;
    }
  }

  async function updateTask(taskId, updates) {
    const task = tasks.find((item) =>
      String(item.id) === String(taskId) && item.user === savedUsername,
    );
    if (!task) return;

    setTasksError("");
    try {
      const response = await fetch(`${TASKS_API_URL}/${encodeURIComponent(task.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          ...updates,
          status: updates.status ?? task.status,
          deadline: updates.deadline ?? task.deadline,
          user: task.user,
        }),
      });
      if (!response.ok) throw new Error(`Nepavyko atnaujinti užduoties (${response.status}).`);

      setTasks((currentTasks) => currentTasks.map((item) =>
        String(item.id) === String(taskId) ? { ...item, ...updates } : item,
      ));
    } catch (error) {
      setTasksError(getApiErrorMessage(error, "Nepavyko atnaujinti užduoties."));
      await loadTasks();
      throw error;
    }
  }

  async function handleDeleteTask(taskId) {
    const task = tasks.find((item) =>
      String(item.id) === String(taskId) && item.user === savedUsername,
    );
    if (!task) return;

    setTasksError("");
    try {
      const response = await fetch(`${TASKS_API_URL}/${encodeURIComponent(task.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`Nepavyko ištrinti užduoties (${response.status}).`);

      setTasks((currentTasks) => currentTasks.filter((item) => String(item.id) !== String(taskId)));
    } catch (error) {
      setTasksError(getApiErrorMessage(error, "Nepavyko ištrinti užduoties."));
      throw error;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const userTasks = tasks.filter((task) => task.user === savedUsername);
  const completedTaskCount = userTasks.filter(
    (task) => task.status === "Atlikta",
  ).length;
  const overdueTaskCount = userTasks.filter((task) => {
    if (task.status === "Atlikta" || !task.deadline) return false;

    const deadline = new Date(`${task.deadline}T00:00:00`);
    return deadline < today;
  }).length;

  return (
    <>
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {activePage === "home" && <Weather />}

      {activePage === "home" && (
        <>
          {isLoggedIn && (
            <header className="welcome-message">
              <h1>Sveiki sugrįžę!</h1>
                  <p>Prisijungėte kaip {savedUsername}.</p>
            </header>
          )}

          <main className="login-page">
            {isLoggedIn && tasksError && (
              <p className="tasks-error" role="alert">
                {tasksError} <button type="button" onClick={loadTasks}>Bandyti dar kartą</button>
              </p>
            )}
            {!isLoggedIn && (
              <div className="login-card">
                <>
                  <header className="login-card__header">
                    <h1>{isRegistering ? "Registruotis" : "Prisijungti"}</h1>
                    <p>{isRegistering ? "Sukurkite vartotojo paskyrą" : "Įveskite savo duomenis, kad tęstumėte"}</p>
                  </header>

                  <form className="login-form" onSubmit={handleSubmit}>
                    <label className="login-field">
                      <span>Vartotojo vardas</span>
                      <input
                        type="text"
                        name="user"
                        autoComplete="username"
                        placeholder="Vartotojo vardas"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </label>

                    <label className="login-field">
                      <span>Slaptažodis</span>
                      <input
                        type="password"
                        name="password"
                        autoComplete={isRegistering ? "new-password" : "current-password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </label>

                    <button type="submit" className="login-submit" disabled={authLoading}>
                      {authLoading ? "Prašome palaukti..." : isRegistering ? "Registruotis" : "Prisijungti"}
                    </button>

                    <button
                      type="button"
                      className="auth-mode-toggle"
                      disabled={authLoading}
                      onClick={() => {
                        setIsRegistering((current) => !current);
                        setLoginError("");
                        setAuthMessage("");
                      }}
                    >
                      {isRegistering ? "Jau turite paskyrą? Prisijunkite" : "Neturite paskyros? Registruokitės"}
                    </button>

                    {authMessage && <p className="auth-message" role="status">{authMessage}</p>}

                    {loginError && (
                      <p className="login-error" role="alert">
                        {loginError}
                      </p>
                    )}
                  </form>
                </>
              </div>
            )}

            {isLoggedIn && (
              <>
                <section className="dashboard-summary" aria-label="Užduočių suvestinė">
                  <p>
                    <strong>{userTasks.length} užduotys</strong>
                    <span aria-hidden="true">·</span>
                    <strong>{completedTaskCount} atliktos</strong>
                    <span aria-hidden="true">·</span>
                    <strong>{overdueTaskCount} vėluoja</strong>
                  </p>
                </section>

                <TaskList
                  tasks={userTasks}
                  loading={tasksLoading}
                  onUpdateTask={updateTask}
                  onDeleteTask={handleDeleteTask}
                />

                <AddTaskForm onAddTask={handleAddTask} />

                <ProgressBar initialProgress={50} />
              </>
            )}
          </main>
        </>
      )}

      {activePage === "profile" && (
        <Profile
          user={user}
          tasks={userTasks}
          onNameChange={(name) => setUser((currentUser) => ({ ...currentUser, name }))}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

export default App;
