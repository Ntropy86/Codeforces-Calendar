// popup.js

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
  const calllback = async (err, data) => {
    if (err) {
      console.log(err);
    } else {
      console.log("BKAAA", data);
      return data;
    }
  };
  const userInfo = await getURL(url, calllback);
  if (userInfo == null || userInfo == undefined || userInfo.length == 0) {
    console.error(`ERROR: User ${userName} not found`);
    throw new Error(`User ${userName} not found`);
  }
  console.log("SUCCESS: userInfo", userInfo);
  return userInfo.result;
};

const problems = async (userRating) => {
  try {
    offset = 200;
    userRating = Math.ceil(userRating / 100) * 100 + offset;
    console.info("INFO: userRating With Offset", userRating);
    const url = "https://codeforces.com/api/problemset.problems";
    const calllback = async (err, data) => {
      if (err) {
        console.error(err);
      } else {
        return data;
      }
    };
    const allProblemsRes = await getURL(url, calllback);
    const filteredProblems = await allProblemsRes.result.problems.filter((item) => {
      return item.rating === userRating;
    });
    console.info(`INFO: filteredData-> Problems with Rating >= ${userRating} `, filteredProblems);
    return filteredProblems;
  } catch (error) {
    console.error(`${error}`);
    throw new Error(error);
  }
};

async function getURL(url) {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        // Request successful
        var response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        // Request failed
        reject(new Error("Request failed"));
      }
    };
    xhr.onerror = function () {
      // Connection error
      reject(new Error("Connection error"));
    };
    xhr.send();
  });
}

const sequence = async () => {
  try {
    await recordUsername();
    const userName = await getData("userData");
    console.log("INFO: User Name", userName);
    generateAlgorithm(userName.username);
    const userInfoResponse = await codeForcesInfo(userName.username);
    storeData("userInfo", userInfoResponse);
    const userInfo = await getData("userInfo");
    if (userInfo.length == 0) {
      throw new Error(`User ${userName} not found`);
    }
    console.log("INFO: userInfo", userInfo);
    const userRating = userInfo[0].rating;
    console.info("INFO: userRating", userRating);
    const filteredProblems = await problems(userRating);

    const currentDate = new Date();
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

    // Send a message to the background script to inject the calendar HTML
    chrome.runtime.sendMessage({ action: "injectCalendarHTML" });
  } catch (err) {
    console.error(`${err}`);
  }
};

const main = () => {
  try {
    usernameButton.addEventListener("click", sequence);
  } catch (err) {
    console.error(`${err}`);
  }
};

document.addEventListener("DOMContentLoaded", main);
