// document.addEventListener('DOMContentLoaded', function() {})

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

usernameButton.addEventListener('click', recordUsername);

const codeForcesInfo = async(userName)=>{
  console.log(`INFO: Fetched User Data: ${userName}`);
  const url = `https://codeforces.com/api/user.info?handles=${userName}`
  const calllback = (err, data) => {
    if (err) {
        console.log(err);
    } else {
        // console.log(data);
        return data;
    }
  }
  const userInfo = await getURL(url, calllback);
  console.log("SUCCESS: userInfo", userInfo);
  return userInfo;
}

const problems = async()=>{
  const url ='https://codeforces.com/api/problemset.problems'
  const calllback = (err, data) => {
    if (err) {
        console.log(err);
    } else {
        const filteredData = data.result.problems.filter((item) => { return item.rating > 1500})
        console.log("filteredData", filteredData);
        return filteredData;
    }
  }
  const filteredProblems = await getURL(url, calllback);
  return filteredProblems;
}

async function getURL(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);

  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 400) {
      // Request successful
      var response = JSON.parse(xhr.responseText);
      callback(null, response);
    } else {
      // Request failed
      callback(new Error('Request failed'));
    }
  };

  xhr.onerror = function() {
    // Connection error
    callback(new Error('Connection error'));
  };

  xhr.send();
}


usernameButton.addEventListener('click', sequence);
try{}
catch(err){
  console.log(err);
}

const sequence = async()=>{
  await recordUsername();
  const userName = localStorage.getItem('userData');
  generateAlgorithm(userName);
  const userInfo = await codeForcesInfo(userName);
  console.log(`INFO: User Info: ${userInfo}`);
  // const filteredProblems = await problems();
  // console.log(`INFO: Filtered Problems: ${filteredProblems}`);
}

sequence();