const creds = require("./creds");
const accountSid = creds.accountSid;
const authToken = creds.authToken;
const txtNum = creds.num;
const client = require('twilio')(accountSid, authToken);
const express = require('express');
const handlebars =  require("express-handlebars");
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/taskslist');
var schedule = require('node-schedule');
const bodyParser = require('body-parser');
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

//will use this for testing 
//0 - send text
//1 - print to console
//2 - send both.

var testing = 1;

var taskSchema = new mongoose.Schema({

  name: String,
  important: Boolean,
  time: String,
  number: String
})

var Task = mongoose.model('Task', taskSchema);

//our current task list. 
var taskList = 'test';
var objList = [];
var from;
var to;

//should have other function here that is always live checking for tasks that should be sent 
//in mean time work on parsing texts and getting a schema
// set interval
//https://stackoverflow.com/questions/20499225/i-need-a-nodejs-scheduler-that-allows-for-tasks-at-different-intervals


function getDB(){

  Task.find(function(err,all){
  if(err)
    {console.log(err);}
  console.log(all);
  });

}

app.get('/', function(request, response){

  response.redirect('/text');
})

app.get('/trigger', function(request, response){

  console.log('**triggered**');
  response.send('triggered');

  getDBText(1,1);


})


app.get('/trigger2', function(request, response){

  doneTask('done 1 2 3');
  response.send('deleting...');

})

app.get('/text', function(request, response){

  response.render('text');

})

app.post('/texteverything/message', function(request, response) {

  response.set('Content-Type', 'text/xml');
  response.set('Status',403);

  from = (request.body.From);
  to = (request.body.To);
  console.log("from:", from, " To: ", to)


  readBody(request.body);

  //just prints everything in the db 
  Task.find(function(err,all){
    if(err)
      {console.log(err);}
    console.log(all);

  })

  response.redirect('/text');

});


//reads the tet and will decide what to do with it. curr will just add to todo list
function readBody(body){

  

  //pushes to data struct/db might want to move this to bottom. used temp while newReminder is fixed.
  // toDo(body.text);

  body.Body = body.Body.toLowerCase();

  console.log("in readBody body: ", body);
  
  if(body && body.Body.includes('rm'))
  {
    //will insert a new task.
    console.log("*includes rm*");

    newReminder(body.Body);

  }
  else if(body.Body.includes('tasks'))
  {
    //send all tasks
    console.log('in tasks ');
    getDBText(body.From, body.To);
  }
  else if(body.Body.includes('done'))
  {
    doneTask(body.Body);
  }
  else
  {

    console.log("help or invalid input");

    response = 
      "Textminder Help:\n" +
      "tasks - gets all tasks in list \n" +
      "rm to get milk - will remind 1x day\n" +
      "rm to get milk! - will remind 3x a day\n" +
      "rm to get milk at 6pm - will remind at specific time\n" +
      "rm to get milk, buy crack \n" +
      "rm to get milk 1hr - will remind to get milk in 1hr \n" +
      "done 1 3 - will clear items 1 & 3 from tasklist";


    sendText(client, from, to, response);
    console.log(response);
  }

}

function doneTask(body)
{

  var tasks = [];
  var success = 1;
  console.log('in donetask: ', body);

  Task.find(function(err,all){


    if(body)
    {

      console.log('**body**', body);

      if(body.includes('done'))
      {
        bodyText = body.replace('done','');

        if(bodyText.includes(' '))
        {
          bodyText = bodyText.split(' ');
        }

        bodyText.forEach(function(x){
          console.log('x:', x);

          if(x){

            if(all[x-1])
            {
              var tempObj = all[x-1];
              console.log('tempObj: ', tempObj._id);

              Task.findByIdAndRemove(tempObj._id,function(err,x){

                if(err)
                  {console.log(err)}
              })        
            }


          }

        })

      }

    }

  });

}

//just take in just the text, no other shiet. 
function newReminder(body)
{

  console.log('new Reminder: ', body);

  var d = new Date();
  var n = d.toISOString();

  newTasks = [];
  bodyText = body.replace('rm','');

  if(bodyText.includes(','))
  {

    var tempTask = bodyText.split(',');
    tempTask.forEach(function(t){

      var singleTask = new task(t, false, n, body.From );
      if(t.includes('!'))
      {
        singleTask.important = true;
      }

      toDo(singleTask);

    });
    
  }else{

    var singleTask = new task(bodyText, false, n, body.From);
    console.log('body.from: ', body.From);
    console.log('single task: ', singleTask);
    if(bodyText.includes('!'))
    {
      singleTask.important = true;
    }

    toDo(singleTask);

  }

}

//once a task is created should add it to db or list
function toDo(task){

  // objList.push(task);

  var newTask = new Task({

    name: task.name,
    important: task.important,
    time: task.time,
    number: task.number

  })

  newTask.save(function(err,task){

    if(err)
    {
      console.log(err);
    }

  });


}

//responds with tasks. 
function sendText(client, from, to, response){


  console.log('In sendText: from:', from, ' to: ', to, ' response: ', response);

  client.messages
  .create({
     body: response,
     from: to,
     to: from
   })
  .then(message => console.log(message)); 


}

function printList(tasks){

  var smsBody = 'Reminders:';

  objList.forEach(function(t){

    smsBody = smsBody + '\n- ' + t.name + " " + t.important + " " + t.time;

  });
    
  console.log("readBody smsBody: ", smsBody);

  sendText(client, from, to, smsBody);
}

function task(name, important, time, number){

  this.name = name;
  this.important = important;
  this.time = time;
  this.number = number;

}

//gets the current task list and creates a string to send in a msg, then is returned
function parseDBdata(all){

  var msg = [];
  msg += '\n';
  msg += '-------';
  var i = 1;

  all.forEach(function(x){

    msg += '\n' + i + '. ' + x.name ;
    i += 1;
  })

  console.log("your message is: ", msg);
  return msg;
}

//gets all data from db > sends it to be parsed  > if successful then sends text.
function getDBText(from, to){

  Task.find(function(err,all){
  if(err)
    {console.log(err);}

    msg = parseDBdata(all);

    if(msg){
      sendText(client, from, to, msg);
    }
    else{
      sendText(client, from, to, 'You dont have anything!')
    }


  });

}



app.listen('1337', function() {
  console.log(`TextEverything listening on port 1337`);

  var j = schedule.scheduleJob('0 * * * *', function(fireDate){
    console.log('Scheduled Job Started!' + fireDate + ', actually ran at ' + new Date());
    var d = new Date();
    d = d.getHours();

    if((d % 2) && (d >= 12 && d <= 23))
    {
      getDBText(txtNum, txtNum);
    }
    

  });

});