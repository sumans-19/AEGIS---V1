import tkinter as tk
from tkinter import messagebox
from pymongo import MongoClient

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["collegeDB"]
collection = db["students"]

# Insert student record into MongoDB
def insert_student():
    name = name_entry.get()
    roll = roll_entry.get()
    branch = branch_entry.get()
    cgpa = cgpa_entry.get()

    if not (name and roll and branch and cgpa):
        messagebox.showwarning("Input Error", "All fields are required!")
        return

    try:
        cgpa = float(cgpa)
        collection.insert_one({"name": name, "roll": roll, "branch": branch, "cgpa": cgpa})
        messagebox.showinfo("Success", "Student record inserted.")
        name_entry.delete(0, tk.END)
        roll_entry.delete(0, tk.END)
        branch_entry.delete(0, tk.END)
        cgpa_entry.delete(0, tk.END)
    except ValueError:
        messagebox.showerror("Invalid Input", "CGPA must be a number.")

# Display all student records
def display_students():
    students = collection.find()
    result_text.delete("1.0", tk.END)
    for s in students:
        result_text.insert(tk.END, f"{s['name']} | {s['roll']} | {s['branch']} | {s['cgpa']}\n")

# GUI setup
app = tk.Tk()
app.title("Student Database App (MongoDB)")

tk.Label(app, text="Name:").grid(row=0, column=0)
name_entry = tk.Entry(app)
name_entry.grid(row=0, column=1)

tk.Label(app, text="Roll No:").grid(row=1, column=0)
roll_entry = tk.Entry(app)
roll_entry.grid(row=1, column=1)

tk.Label(app, text="Branch:").grid(row=2, column=0)
branch_entry = tk.Entry(app)
branch_entry.grid(row=2, column=1)

tk.Label(app, text="CGPA:").grid(row=3, column=0)
cgpa_entry = tk.Entry(app)
cgpa_entry.grid(row=3, column=1)

tk.Button(app, text="Insert Student", command=insert_student).grid(row=4, column=0, columnspan=2, pady=10)
tk.Button(app, text="Show All Students", command=display_students).grid(row=5, column=0, columnspan=2, pady=5)

result_text = tk.Text(app, width=50, height=10)
result_text.grid(row=6, column=0, columnspan=2, padx=10, pady=10)

app.mainloop()
