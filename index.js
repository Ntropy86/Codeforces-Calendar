const usernameElement = document.getElementById("userName");
const usernameButton = document.getElementById("userNameBtn");
const userData = {}

const conditionalRender = async()=>{
  usernameButton.innerHTML = "Success!";
  // usernameButton.remove()
}
const recordUsername = async()=>{
  usernameButton.innerHTML = "Loading...";
  console.log(usernameElement.value);
  userData['username'] = usernameElement.value;
  localStorage.setItem('userData', JSON.stringify(userData));
  usernameButton.removeEventListener('click', recordUsername);
  await conditionalRender();
}
const generateAlgorithm = async(userName)=>{
  console.log("Lolva Algo",userName);
}
// usernameButton.addEventListener('click', recordUsername);
const codeForcesInfo = async(userData)=>{
  const userName = JSON.parse(userData).username;
  // console.info(`INFO: Fetched User Data: ${userName}`);
  const url = `https://codeforces.com/api/user.info?handles=${userName}`
  const calllback = async(err, data) => {
    if (err) {
        console.log(err);
    } else {
        console.log("BKAAA", data);
        return data;
    }
  }
  const userInfo = await getURL(url,calllback);
  if(userInfo==null||userInfo==undefined||userInfo.length==0){
    // console.error(`ERROR: User ${userName} not found`);
    throw new Error(`User ${userName} not found`);
  }
  console.log("SUCCESS: userInfo", userInfo);
  return userInfo;
  }

const problems = async(userRating)=>{
  try {
    offset = 200;
    userRating = Math.ceil(userRating/100)*100 + offset;
    console.info("INFO: userRating With Offset", userRating);
    const url ='https://codeforces.com/api/problemset.problems'
  const calllback = async(err, data) => {
    if (err) {
        console.error(err);
    } else {
        return data;
    }
  }
  const allProblemsRes = await getURL(url, calllback);
  const filteredProblems = await allProblemsRes.result.problems.filter((item) => { return item.rating >= userRating; });
  console.info(`INFO: filteredData-> Problems with Rating >= ${userRating} `, filteredProblems);
  return filteredProblems;
  } catch (error) {
    console.error(`${error}`);
    throw new Error(error);
  }
}

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

const sequence = async()=>{
  try {
      await recordUsername();
      const userName = localStorage.getItem('userData');
      generateAlgorithm(userName);
      const userInfo = await codeForcesInfo(userName);
      if(userInfo.status!== "OK"){

      }
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
      const userRating = userInfo.result[0].rating;
      console.info("INFO: userRating", userRating);
      const filteredProblems = await problems(userRating);
      // console.log('INFO: Filtered Problems:', filteredProblems);

      //Now Based on the Algorithm, Classify and  Either: 
        // Store the problems in Localstorage
        // Or, Make the GenAlgo Function in a way that we can get results from it
  }
  catch(err){
      console.error(`${err}`);
  }
}

const main = ()=>{
  console.info("INFO: DOM Loaded");
  usernameButton.addEventListener('click', sequence);
}

document.addEventListener('DOMContentLoaded', main )




