const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "0497",
  database: "440_quiz_system",
});

const _db_teachers = "teachers";
const _db_questions = "questions";
const _db_answers = "answers";
const _db_quizzes = "quizzes";
const _db_student_quiz_progress = "student_quiz_progress";
//
const quiz_pending = "pending";
const quiz_started = "started";
const quiz_finished = "finished";

app.post("/teacher-register", async (req, res) => {
  const { fname, lname, username, password } = req.body;

  let dataToInsert = {
    fname,
    lname,
    username,
    password,
  };
  let query1 = `INSERT INTO ${_db_teachers} SET ?;`;
  db.query(query1, dataToInsert, (err, result) => {
    if (err) {
      res.json({
        msg: "Username already exists",
      });
    } else {
      res.json({
        msg: "Teacher Registered Successfully",
      });
    }
  });
});

app.post("/teacher-login", (req, res) => {
  const { username, password } = req.body;

  let query = `SELECT * FROM ${_db_teachers} WHERE username = '${username}' AND password = '${password}';`;
  db.query(query, (err, result) => {
    if (result.length == 0) {
      res.json({
        status: 0,
        msg: "Wrong Credentials",
      });
    } else {
      res.json({
        status: 1,
        result,
      });
    }
  });
});

app.post("/teacher-add-question", (req, res) => {
  const { teacher_id, question, answers } = req.body;

  let query = `INSERT INTO ${_db_questions} (question, teacher_id) VALUES (?, ?)`;
  let queryData = [question, teacher_id];
  db.query(query, queryData, (err, result) => {
    if (err) {
      console.log(err);
      res.json({
        status: 0,
        msg: "Unable to add the question",
      });
    } else {
      let wasAddingSuccessful = true;
      answers.forEach((answer) => {
        let query1 = `INSERT INTO ${_db_answers} (question_id, answer, is_correct) VALUES (?, ?, ?)`;
        let values = [result.insertId, answer.answer, answer.is_correct];

        db.query(query1, values, (err) => {
          if (err) {
            wasAddingSuccessful = false;
          }
        });
      });
      if (!wasAddingSuccessful) {
        res.json({
          status: 0,
          msg: "Error adding questions",
        });
      } else {
        res.json({
          status: 1,
          msg: "Questions were added successfully",
        });
      }
    }
  });
});

app.post("/teacher-get-questions", (req, res) => {
  let query = `
  SELECT 
    ${_db_questions}.id as question_id,
    ${_db_questions}.question,
    ${_db_teachers}.fname as teacher_fname,
    ${_db_teachers}.lname as teacher_lname,
    CONCAT('[', GROUP_CONCAT(
      JSON_OBJECT(
        'answer_id', ${_db_answers}.id,
        'answer', ${_db_answers}.answer,
        'is_correct', ${_db_answers}.is_correct
      )
      ORDER BY ${_db_answers}.id
    ), ']') AS answers
  FROM ${_db_questions}
  LEFT JOIN ${_db_answers} ON ${_db_questions}.id = ${_db_answers}.question_id
  JOIN ${_db_teachers} ON ${_db_questions}.teacher_id = ${_db_teachers}.id
  GROUP BY ${_db_questions}.id;
`;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the Questions and Answers",
      });
    } else {
      res.json({
        status: 1,
        result,
      });
    }
  });
});

app.post("/teacher-create-quiz", (req, res) => {
  const { teacher_id, questions, passcode } = req.body;

  let query = `
  INSERT INTO ${_db_quizzes}
  (teacher_id, passcode, questions)
  VALUES
  (${teacher_id}, '${passcode}', JSON_ARRAY(${questions.join(", ")}))
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      res.json({
        status: 0,
        msg: "Unable to add Quiz",
      });
    } else {
      res.json({
        status: 1,
        msg: "Quiz added successfully",
      });
    }
  });
});

app.post("/teacher-get-quizzes", (req, res) => {
  let query = `
  SELECT 
    ${_db_quizzes}.id,
    ${_db_quizzes}.passcode,
    ${_db_quizzes}.questions,
    ${_db_teachers}.fname,
    ${_db_teachers}.lname
  FROM ${_db_quizzes}
  LEFT JOIN ${_db_teachers} ON ${_db_teachers}.id = ${_db_quizzes}.teacher_id;
`;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the Questions and Answers",
      });
    } else {
      res.json({
        status: 1,
        result,
      });
    }
  });
});

app.post("/teacher-get-questions-for-quiz", (req, res) => {
  const { questionIDs } = req.body;

  let query = `
  SELECT
    ${_db_questions}.id as question_id,
    ${_db_questions}.question as question,
    ${_db_answers}.answer as answer
  FROM ${_db_questions}
  LEFT JOIN ${_db_answers} ON ${_db_answers}.question_id = ${_db_questions}.id AND ${_db_answers}.is_correct = 1
  WHERE ${_db_questions}.id IN (${questionIDs.join(", ")});
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the Questions and Answers for the quiz",
      });
    } else {
      res.json({
        status: 1,
        result,
      });
    }
  });
});

app.post("/student-login", (req, res) => {
  const { quiz_id, student_id, student_name, quiz_password } = req.body;

  let query = `
    SELECT *
    FROM ${_db_quizzes}
    WHERE id = ${quiz_id} AND passcode = '${quiz_password}'
  `;
  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Error occured",
      });
    } else if (!result.length) {
      res.json({
        status: 0,
        msg: "Wrong quiz information",
      });
    } else {
      let query = `
      SELECT *
      FROM ${_db_student_quiz_progress}
      WHERE
      student_id = ${student_id}
      AND
      quiz_id = ${quiz_id}
      AND
      student_name = '${student_name}'
    `;

      db.query(query, (err, result) => {
        if (err) {
          res.json({
            status: 0,
            msg: "Unable to get the progress info",
          });
        } else {
          if (result.length === 0) {
            let query1 = `
                  INSERT INTO ${_db_student_quiz_progress}
                  (student_id, student_name, quiz_id, status)
                  VALUES
                  (${student_id}, '${student_name}', ${quiz_id}, '${quiz_pending}')
                `;

            db.query(query1, (err, result) => {
              if (err) {
                res.json({
                  status: 0,
                  msg: "Unable to get the progress info after inserting",
                });
              } else {
                res.json({
                  status: 1,
                  progress_id: result.insertId,
                });
              }
            });
          } else {
            res.json({
              status: 1,
              progress_id: result[0].id,
            });
          }
        }
      });
    }
  });
});

app.post("/student-get-quiz-progress", (req, res) => {
  const { progress_id } = req.body;

  let query = `
    SELECT *
    FROM ${_db_student_quiz_progress}
    WHERE ${_db_student_quiz_progress}.id = ${progress_id}
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the quiz progress",
      });
    } else {
      res.json({
        status: result[0].status,
      });
    }
  });
});

app.post("/student-get-general-quiz-info", (req, res) => {
  const { quiz_id } = req.body;

  let query = `
    SELECT
      ${_db_quizzes}.questions,
      ${_db_teachers}.fname as teacher_fname,
      ${_db_teachers}.lname as teacher_lname
    FROM
      ${_db_quizzes}
    LEFT JOIN
      ${_db_teachers} ON ${_db_teachers}.id = ${_db_quizzes}.teacher_id
    WHERE
      ${_db_quizzes}.id = ${quiz_id}
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get quiz info",
      });
    } else {
      res.json({
        status: 1,
        result,
      });
    }
  });
});

app.post("/student-start-quiz", (req, res) => {
  const { progress_id } = req.body;

  let query = `
    UPDATE ${_db_student_quiz_progress}
    SET status = '${quiz_started}', started = NOW()
    WHERE id = ${progress_id}
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to start the quiz",
      });
    } else {
      res.json({
        status: 1,
        msg: "Quiz Started",
      });
    }
  });
});

app.post("/student-get-started-quiz-progress", (req, res) => {
  const { progress_id } = req.body;

  let query = `
    SELECT *
    FROM ${_db_student_quiz_progress}
    WHERE ${_db_student_quiz_progress}.id = ${progress_id}
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the quiz progress",
      });
    } else {
      res.json({
        status: 1,
        result: result,
      });
    }
  });
});

app.post("/student-get-quiz-questions", (req, res) => {
  const { quiz_id } = req.body;

  let query = `
    SELECT ${_db_quizzes}.questions FROM ${_db_quizzes} WHERE id = ${quiz_id}
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the question IDs form quizzes table",
      });
    } else {
      let questionIDs = result[0].questions;
      let query1 = `
          SELECT
            ${_db_questions}.id as question_id,
            ${_db_questions}.question as question,
            CONCAT('[', GROUP_CONCAT(CONCAT('{"id": ', ${_db_answers}.id, ', "answer": "', ${_db_answers}.answer, '"}')), ']') AS answers
          FROM ${_db_questions}
          LEFT JOIN ${_db_answers} ON ${_db_answers}.question_id = ${_db_questions}.id
          WHERE ${_db_questions}.id IN (${questionIDs.join(", ")})
          GROUP BY ${_db_questions}.id, ${_db_questions}.question;
        `;

      db.query(query1, (err, result) => {
        if (err) {
          console.log(err);
          res.json({
            status: 0,
            msg: "Unable to get the questions based on ID's",
          });
        } else {
          result.forEach((row) => {
            row.answers = JSON.parse(row.answers);
          });
          res.json({
            status: 1,
            result,
          });
        }
      });
    }
  });

  // res.json("ssss");
});

app.post("/student-submit-quiz", (req, res) => {
  const { quiz_question_ids, quiz_progress_id, selected_answers } = req.body;

  let query = `
      SELECT
      ${_db_questions}.id as question_id,
      ${_db_answers}.id as answer_id
      FROM ${_db_questions}
      LEFT JOIN ${_db_answers} ON ${_db_answers}.question_id = ${_db_questions}.id AND ${_db_answers}.is_correct = 1
      WHERE ${_db_questions}.id IN (${quiz_question_ids.join(", ")});
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.log(err);
      res.json({
        status: 0,
        msg: "unable to get the questions and answers to compare with submitted ones",
      });
    } else {
      const checkFeedback = checkAnswers(selected_answers, result);
      const TotalQuizPoints = checkFeedback.length;
      const StudentEarnedPoints = countCorrectAnswers(checkFeedback);
      const FinalPercentage = calculatePercentageGrade(
        StudentEarnedPoints,
        TotalQuizPoints
      );

      let query1 = `
        UPDATE ${_db_student_quiz_progress}
        SET
          status = '${quiz_finished}',
          finished = NOW(),
          total_quiz_points = ${TotalQuizPoints},
          student_earned_points = ${StudentEarnedPoints},
          final_percentage = ${FinalPercentage}
        WHERE id = ${quiz_progress_id}
      `;

      db.query(query1, (err, result) => {
        if (err) {
          res.json({
            status: 0,
            msg: "Unable to submit the quiz",
          });
        } else {
          res.json({
            status: 1,
            msg: "Quiz submitted Successfully",
          });
        }
      });
    }
  });
});

app.post("/teacher-get-submissions-for-quiz", (req, res) => {
  const { quiz_id } = req.body;

  let query = `
    SELECT *
    FROM ${_db_student_quiz_progress}
    WHERE ${_db_student_quiz_progress}.quiz_id = ${quiz_id}
  `;

  db.query(query, (err, result) => {
    if (err) {
      res.json({
        status: 0,
        msg: "Unable to get the quiz progresses",
      });
    } else {
      res.json({
        status: 1,
        result,
      });
    }
  });
});

app.listen(3000, () => {
  console.log("APP IS RUNNING ON PORT 3000");
});

const checkAnswers = (selectedAnswers, correctAnswers) => {
  // Map selected answers to an object for efficient lookup
  const selectedAnswersMap = selectedAnswers.reduce((acc, answer) => {
    const questionId = Object.keys(answer)[0];
    const answerId = answer[questionId];
    acc[questionId] = answerId;
    return acc;
  }, {});

  // Map correct answers to an object for efficient lookup
  const correctAnswersMap = correctAnswers.reduce(
    (acc, { question_id, answer_id }) => {
      acc[question_id] = answer_id;
      return acc;
    },
    {}
  );

  // Get all unique question IDs
  const allQuestionIds = new Set([
    ...Object.keys(selectedAnswersMap),
    ...Object.keys(correctAnswersMap),
  ]);

  // Check each question's answer
  const results = Array.from(allQuestionIds).map((questionId) => {
    const selectedAnswerId = selectedAnswersMap[questionId] || null;
    const correctAnswerId = correctAnswersMap[questionId] || null;
    const isCorrect = selectedAnswerId === correctAnswerId;
    return { questionId, selectedAnswerId, correctAnswerId, isCorrect };
  });

  return results;
};

const countCorrectAnswers = (results) => {
  return results.reduce((count, result) => {
    return count + (result.isCorrect ? 1 : 0);
  }, 0);
};

const calculatePercentageGrade = (pointsObtained, totalPossiblePoints) => {
  const percentage = (pointsObtained / totalPossiblePoints) * 100;
  return percentage;
};
