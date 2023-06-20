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
 // location.reload();
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


 // location.reload();  //added
};

const generateAlgorithm = async (userName) => {
  console.log("Lolva Algo", userName);
};

const codeForcesInfo = async (userData) => {
  console.info(`INFO: Fetched User Data: ${userData}`);
  const url = `https://codeforces.com/api/user.info?handles=${userData}`;
  const userInfo = await fetch(url).then((response) => response.json());
  if (userInfo.result.length === 0) {
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
    if(userRating == undefined)
    {
      userRating = 600;
    }
    console.info("INFO: userRatingAfterCheck--> ", userRating);
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

const sequence = async () => {
  try {
    await recordUsername();
    const userName = await getData("userData");
    console.log("INFO: User Name", userName);
   // generateAlgorithm(userName.username);
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

    // Send a message to the background script to inject calendar HTML
    chrome.runtime.sendMessage({ action: "injectCalendarHTML" });
   // location.reload();
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