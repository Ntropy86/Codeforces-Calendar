const usernameElement = document.getElementById("userName");
const usernameButton = document.getElementById("userNameBtn");

const storeData = async (key, value) => {
  try {
    await chrome.storage.local.set({ [key]: value });
    console.log(`Data stored successfully: ${key}`);
  } catch (error) {
    console.error(`Error storing data: ${key}`, error);
  }
};

const getData = async (key) => {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch (error) {
    console.error(`Error fetching data: ${key}`, error);
    throw error;
  }
};

const conditionalRender = async () => {
  usernameButton.innerHTML = "Success!";
};

const recordUsername = async () => {
  usernameButton.innerHTML = "Loading...";
  console.log(usernameElement.value);
  const userData = {
    username: usernameElement.value,
  };
  await storeData("userData", userData);
  usernameButton.removeEventListener("click", recordUsername);
  await conditionalRender();
};

const generateAlgorithm = async (userName) => {
  console.log("Lolva Algo", userName);
};

const codeForcesInfo = async (userData) => {
  console.info(`INFO: Fetched User Data: ${userData}`);
  const url = `https://codeforces.com/api/user.info?handles=${userData}`;
  const userInfo = await fetch(url).then((response) => response.json());
  if (!userInfo.result || userInfo.result.length === 0) {
    console.error(`ERROR: User ${userData} not found`);
    throw new Error(`User ${userData} not found`);
  }
  console.log("SUCCESS: userInfo", userInfo.result);
  return userInfo.result;
};

const problems = async (userRating) => {
  try {
    const offset = 200;
    console.info("INFO: userRating -->", userRating);
    if (userRating == undefined) {
      userRating = 600;
    }
    userRating = Math.ceil(userRating / 100) * 100 + offset;
    console.info("INFO: userRating With Offset", userRating);
    const url = "https://codeforces.com/api/problemset.problems";
    const allProblemsRes = await fetch(url).then((response) => response.json());
    const filteredProblems = allProblemsRes.result.problems.filter((item) => {
      return item.rating === userRating;
    });
    console.info(`INFO: filteredData -> Problems with Rating >= ${userRating}`, filteredProblems);
    return filteredProblems;
  } catch (error) {
    console.error(`${error}`);
    throw new Error(error);
  }
};

// --- New: Recalculate monthly streak if not already present ---
async function recalcMonthlyStreak(userHandle, problemData) {
  try {
    const response = await fetch(`https://codeforces.com/api/user.status?handle=${userHandle}&count=50`);
    const data = await response.json();
    if (data.status !== "OK") {
      console.error("Error fetching submissions from Codeforces API");
      return 0;
    }
    const submissions = data.result;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter submissions to those made in the current month.
    const monthSubmissions = submissions.filter(sub => {
      const subDate = new Date(sub.creationTimeSeconds * 1000);
      return subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear;
    });

    let streak = 0;
    let day = new Date(now); // Start from today
    while (true) {
      const isoDay = day.toISOString().split('T')[0];
      // Retrieve the problem scheduled for this day
      const todaysProblem = problemData.find(p => p.date.split('T')[0] === isoDay);
      if (!todaysProblem) {
        console.error("Problem data for day", isoDay, "not found");
        break;
      }
      // Check if an accepted submission for today's problem exists
      const solved = monthSubmissions.some(sub => {
        const subIso = new Date(sub.creationTimeSeconds * 1000).toISOString().split('T')[0];
        return subIso === isoDay &&
               sub.problem.contestId === todaysProblem.problem.contestId &&
               sub.problem.index === todaysProblem.problem.index &&
               sub.verdict === "OK";
      });
      if (solved) {
        streak++;
      } else {
        break;
      }
      // Move one day back; stop if we leave the current month
      day.setDate(day.getDate() - 1);
      if (day.getMonth() !== currentMonth) {
        break;
      }
    }
    // Save streak locally along with the last calculated date.
    chrome.storage.local.set({ streakData: { streak: streak, lastCalculated: now.toISOString().split('T')[0] } }, () => {
      console.log("Monthly streak stored:", streak);
    });
    return streak;
  } catch (error) {
    console.error("Error recalculating monthly streak:", error);
    return 0;
  }
}

function updateStreakUI(streak) {
  let streakElement = document.getElementById("streakElement");
  if (!streakElement) {
    streakElement = document.createElement("div");
    streakElement.id = "streakElement";
    streakElement.style.textAlign = "center";
    streakElement.style.marginTop = "10px";
    const calendarContainer = document.getElementById("calendarContainer");
    if (calendarContainer) {
      calendarContainer.insertAdjacentElement("afterend", streakElement);
    }
  }
  streakElement.textContent = `Current Monthly Streak: ${streak}`;
}

// --- Main sequence triggered by popup ---
const sequence = async () => {
  try {
    await recordUsername();
    const userName = await getData("userData");
    console.log("INFO: User Name", userName);
    const userInfoResponse = await codeForcesInfo(userName.username);
    storeData("userInfo", userInfoResponse);
    const userInfo = await getData("userInfo");
    if (!userInfo || userInfo.length === 0) {
      throw new Error(`User ${userName.username} not found`);
    }
    const userRating = userInfo[0].rating;
    const filteredProblems = await problems(userRating);
    const currentDate = new Date();
    // Map problems to each day of the current month
    const problemData = filteredProblems.map((problem, index) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
      return {
        date: date.toISOString(),
        problem: problem,
        url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
      };
    });
    storeData("problemData", problemData);
    console.info("INFO: Problem data stored in local storage.");

    // Use stored streakData if present; otherwise, recalc for the month.
    chrome.storage.local.get(["streakData"], async (result) => {
      // if (result.streakData) {
      //   console.log("Streak data already present. Using stored streak:", result.streakData.streak);
      //   updateStreakUI(result.streakData.streak);
      // } else {
        const currentStreak = await recalcMonthlyStreak(userInfo[0].handle, problemData);
        updateStreakUI(currentStreak);
     // }
    });
    // Tell the background script to inject the calendar HTML into Codeforces
    chrome.runtime.sendMessage({ action: "injectCalendarHTML" });
  } catch (err) {
    console.error("Error in sequence:", err);
  }
};

const main = () => {
  try {
    usernameButton.addEventListener("click", sequence);
  } catch (err) {
    console.error("Error in main:", err);
  }
};

document.addEventListener("DOMContentLoaded", main);
