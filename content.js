function createCalendar() {
  var currentDate = new Date();
  var slicedDate = currentDate.toISOString();
  slicedDate = slicedDate.substring(0, slicedDate.indexOf("T"));
  console.log(slicedDate);
  var currentYear = currentDate.getFullYear();
  var currentMonth = currentDate.getMonth();
  var jugaadMonth = parseInt(currentMonth) + 1;
  var monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  chrome.storage.local.get(["problemData", "userInfo"], function (result) {      
    var problemData = result.problemData;
    var userHandle = result.userInfo ? result.userInfo[0].handle : "Unknown";
    var calendarHTML = '<table style="width:100%" class="calendar">';
    calendarHTML += '<tr><th colspan="7">' + monthNames[currentMonth] + ' ' + currentYear + '</th></tr>';
    calendarHTML += '<tr><td colspan="7">Active user: ' + userHandle + '</td></tr>';
    calendarHTML += '<tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr>';

    var firstDay = new Date(currentYear, currentMonth, 1);
    var startingDay = firstDay.getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var day = 1;
    var isoDate;
    var referenceDate = new Date().getDate();

    for (var i = 0; i < 6; i++) {
      calendarHTML += '<tr>';
      for (var j = 0; j < 7; j++) {
        if (i === 0 && j < startingDay) {
          calendarHTML += '<td></td>';
        } else if (day > daysInMonth) {
          break;
        } else {
          var formattedMonth = jugaadMonth.toString().padStart(2, '0');
          var formattedDay = day.toString().padStart(2, '0');
          isoDate = currentYear + '-' + formattedMonth + '-' + formattedDay;
       //   console.log(isoDate);

          if (problemData) {
            var filteredProblems = problemData.filter(function (problem) {
              var problemDate = problem.date.substring(0, problem.date.indexOf("T"));
              return problemDate == isoDate;
            });

            if (filteredProblems.length > 0) {
              url = filteredProblems[0].url;
            }
          }

          calendarHTML += '<td>' + (url && referenceDate >= day ? '<a href="' + url + '">' + day + '</a>' : day) + '</td>';
          day++;
        }
      }
      calendarHTML += '</tr>';
      if (day > daysInMonth) {
        break;
      }
    }
    calendarHTML += '</table>';

    var sidebar = document.getElementById("sidebar");
    var existingCalendar = document.getElementsByClassName("calendar")[0];
    if (sidebar && existingCalendar) {
      sidebar.removeChild(existingCalendar);
      sidebar.insertAdjacentHTML("afterbegin", calendarHTML);
    } else if (sidebar) {
      sidebar.insertAdjacentHTML("afterbegin", calendarHTML);
    } else {
      console.error("ERROR: Could not find the sidebar element on Codeforces homepage.");
    }
  });

  addSubmitListeners();
}

// --- New: Submit Button Event Listeners & Streak Updates ---

function addSubmitListeners() {
  try {
    const submitButtons = document.querySelectorAll('.submit');
    if (submitButtons.length === 0) {
      console.log("No submit buttons found on this page.");
      return;
    }
    submitButtons.forEach(button => {
      button.addEventListener('click', handleSubmit);
    });
  } catch (error) {
    console.error("Error adding submit listeners:", error);
  }
}

function handleSubmit(event) {
  console.log("Submit button clicked. Starting poll for submission.");
  chrome.storage.local.get(['userInfo', 'problemData'], (result) => {
    const userInfo = result.userInfo;
    const problemData = result.problemData;
    if (!userInfo || !problemData) {
      console.error("User info or problem data not found in storage.");
      return;
    }
    const userHandle = userInfo[0].handle;
    const todayISO = new Date().toISOString().split('T')[0];
    const todaysProblem = problemData.find(problem => problem.date.split('T')[0] === todayISO);
    if (!todaysProblem) {
      console.error("Today's problem not found in problemData.");
      return;
    }
    pollForSubmission(userHandle, todaysProblem);
  });
}

function pollForSubmission(userHandle, todaysProblem) {
  let attempts = 0;
  const maxAttempts = 10; // Poll every 2 seconds, up to 20 seconds total.
  const interval = 2000;
  const pollInterval = setInterval(async () => {
    attempts++;
    console.log(`Polling submission attempt ${attempts}`);
    try {

     const response = await fetch(`https://codeforces.com/api/user.status?handle=${userHandle}&from=1&count=1`);
     const data = await response.json();
      if (data.status !== "OK") {
        console.error("Error fetching submissions from API");
        return;
      }
      if (data.result && data.result.length > 0) {
        const latestSubmission = data.result[0];
        if (latestSubmission.problem.contestId === todaysProblem.problem.contestId &&
            latestSubmission.problem.index === todaysProblem.problem.index &&
            latestSubmission.verdict === "OK") {
          console.log("Submission matches today's problem.");
          clearInterval(pollInterval);
          updateStreakForToday();
          markCalendarTick();
        }
      }
    } catch (error) {
      console.error("Error polling submission:", error);
    }
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.log("Polling ended without detecting a successful submission.");
    }
  }, interval);
}

function updateStreakForToday() {
  const todayISO = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['streakData'], (result) => {
    let streakData = result.streakData || { streak: 0, lastSolvedDate: null };
    if (streakData.lastSolvedDate === todayISO) {
      console.log("Today's submission already recorded.");
      return;
    }
    const yesterday = new Date();
    yesterday.setDate(new Date().getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split('T')[0];
    if (streakData.lastSolvedDate === yesterdayISO) {
      streakData.streak += 1;
    } else {
      streakData.streak = 1;
    }
    streakData.lastSolvedDate = todayISO;
    chrome.storage.local.set({ streakData: streakData }, () => {
      console.log("Updated streak:", streakData.streak);
      updateStreakUI(streakData.streak);
    });
  });
}

function markCalendarTick() {
  const todayISO = new Date().toISOString().split('T')[0];
  const todayDate = new Date().getDate().toString();
  const calendarCells = document.querySelectorAll(".calendar td");
  calendarCells.forEach(cell => {
    if (cell.textContent.trim().startsWith(todayDate)) {
      cell.style.backgroundColor = "#2ecc71"; // green for solved day.
      if (!cell.textContent.includes("✔")) {
        cell.textContent += " ✔";
      }
    }
  });
}

// Initialize calendar and attach event listeners when the DOM loads.

  createCalendar();
  

