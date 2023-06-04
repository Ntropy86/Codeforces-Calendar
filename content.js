function createCalendar() {
  var currentDate = new Date();

  var slicedDate = currentDate.toISOString();
  slicedDate = slicedDate.substring(0, slicedDate.indexOf("T"));
  console.log(slicedDate);

  var currentYear = currentDate.getFullYear();
  var currentMonth = currentDate.getMonth();
  var jugaadMonth = parseInt(currentMonth) + 1;

  // Array of month names
  var monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Create the calendar HTML
  var calendarHTML = '<table style = "width :100%" class="calendar">';
  calendarHTML += '<tr><th colspan="7">' + monthNames[currentMonth] + ' ' + currentYear + '</th></tr>';
  calendarHTML += '<tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr>';

  // Get the first day of the month
  var firstDay = new Date(currentYear, currentMonth, 1);
  var startingDay = firstDay.getDay();

  // Get the number of days in the month
  var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Create the calendar days
  var day = 1;
  var isoDate;
  var url;
  var referenceDate = new Date().getDate();

  // Retrieve data from chrome.storage.local
  chrome.storage.local.get("problemData", function (result) {
    var problemData = result.problemData;

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

          // Create the ISO formatted date
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

    // Append the calendar HTML to the div with id "sidebar"
    var sidebar = document.getElementById("sidebar");
    //console.log(sidebar);
    if (sidebar) {
      // sidebar.innerHTML = calendarHTML;
      sidebar.insertAdjacentHTML("afterbegin", calendarHTML);
      reloadPageOnce();
      //location.reload(); //added
    } else {
      console.error("ERROR: Could not find the sidebar element on Codeforces homepage.");
    }
  });
}

console.log("checkkkkkkkkk");

createCalendar();


//--------------------------------------------testing---------------------------------

