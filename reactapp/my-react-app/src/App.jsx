import { useState, useEffect } from 'react'
import './App.css'
import { db, shoppingdata, auth, googleProvider } from './firebase';
import { addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { signInWithPopup, signOut } from 'firebase/auth';

function Title() {
  return <h1>My Shopping List</h1>
}

function App() {
  const [tasklist, setTasklist] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('importance'); // 'importance', 'chronological', 'user'
  const [userId] = useState(() => {
    // Get or create a unique user identifier
    let id = localStorage.getItem('userId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', id);
    }
    return id;
  });
  
  useEffect(() => {
    loadTasks();
  }, []);
  
  // Reload tasks when user changes
  useEffect(() => {
    if (user) {
      loadTasks();
    } else {
      setTasklist([]);
    }
  }, [user]);

  const handelsignin = async () => {
    if (user) {
      // Sign out
      try {
        await signOut(auth);
        setUser(null);
      } catch (error) {
        console.error("Error signing out:", error);
        alert("Failed to sign out. Please try again.");
      }
    } else {
      // Sign in with Google
      try {
        const result = await signInWithPopup(auth, googleProvider);
        setUser(result.user);
      } catch (error) {
        console.error("Error signing in:", error);
        alert("Failed to sign in. Please try again.");
      }
    }
  }

  // ========================================
  // READ: Load all tasks from Firestore
  // ========================================
  async function loadTasks() {
    if (!user) {
      setTasklist([]);
      setLoading(false);
      return;
    }
    
    try {
      console.log('Loading tasks for user:', user.uid);
      // Query only items created by current user
      const q = query(shoppingdata, where('created_by', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const tasks = [];
      querySnapshot.forEach((doc) => {
        console.log('Loaded document:', doc.id, doc.data());
        tasks.push({ id: doc.id, ...doc.data() });
      });
      console.log('Total tasks loaded:', tasks.length);
      setTasklist(tasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
      alert("Failed to load items from database. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }
  
  // ========================================
  // CREATE: Add new item to the list
  // ========================================
  async function addtask(event) {
    if(event.key === "Enter" && !event.nativeEvent.isComposing && event.target.value.trim() !== "") {
      if (!user) {
        alert("Please sign in to add items.");
        return;
      }
      
      try {
        const newTaskData = { 
          content: event.target.value, 
          style: "cool",
          created_by: user.uid,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(shoppingdata, newTaskData);
        // For local state, use current date as placeholder until refresh
        setTasklist([...tasklist, { id: docRef.id, ...newTaskData, createdAt: new Date() }]);
        event.target.value = "";
      } catch (error) {
        console.error("Error adding task:", error);
        alert("Failed to add item. Please try again.");
      }
    }
  }
  
  // ========================================
  // DELETE: Remove a single item
  // ========================================
  async function deletetask(id) {
    console.log('Deleting task:', id);
    
    // Optimistic update - UI를 먼저 업데이트
    const previousTasklist = tasklist;
    const newtasklist = tasklist.filter((task) => task.id !== id);
    setTasklist(newtasklist);
    
    try {
      const docRef = doc(db, "shoppinglist", id);
      console.log('Deleting document:', docRef.path);
      await deleteDoc(docRef);
      console.log('Delete successful');
    } catch (error) {
      console.error("Error deleting task:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      // When delete fails, revert to previous state
      setTasklist(previousTasklist);
      alert("Failed to delete item. Please try again.");
    }
  }
  
  // ========================================
  // UPDATE: Change item style (cool -> complete -> hot -> cool)
  // ========================================
  async function toggleStyle(id) {
    const task = tasklist.find(t => t.id === id);
    if (!task) return;
    
    console.log('Toggling style for task:', { id, currentStyle: task.style });
    
    // Cycle through: cool -> complete -> hot -> cool
    const styleOrder = { cool: "complete", complete: "hot", hot: "cool" };
    const newStyle = styleOrder[task.style] || "cool";
    
    console.log('New style will be:', newStyle);
    
    // Optimistic update
    const previousTasklist = tasklist;
    const updatedTasklist = tasklist.map(t => 
      t.id === id ? { ...t, style: newStyle } : t
    );
    setTasklist(updatedTasklist);
    
    try {
      const docRef = doc(db, "shoppinglist", id);
      console.log('Updating document:', docRef.path);
      await updateDoc(docRef, { style: newStyle });
      console.log('Update successful');
    } catch (error) {
      console.error("Error updating task style:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      setTasklist(previousTasklist);
      alert("Failed to update item status. Please try again.");
    }
  }
  
  // ========================================
  // DELETE: Clear all items
  // ========================================
  async function clearAll() {
    if (!window.confirm("Are you sure you want to delete all items?")) return;
    
    // Optimistic update
    const previousTasklist = tasklist;
    setTasklist([]);
    
    try {
      const deletePromises = previousTasklist.map(task => 
        deleteDoc(doc(db, "shoppinglist", task.id))
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error clearing tasks:", error);
      setTasklist(previousTasklist);
      alert("Failed to clear all items. Please try again.");
    }
  }
  
  // ========================================
  // DELETE: Remove all completed items
  // ========================================
  async function deleteCompleted() {
    const completedTasks = tasklist.filter(task => task.style === "complete");
    if (completedTasks.length === 0) {
      alert("No completed items to delete.");
      return;
    }
    
    if (!window.confirm(`Delete ${completedTasks.length} completed item(s)?`)) return;
    
    // Optimistic update
    const previousTasklist = tasklist;
    const remainingTasks = tasklist.filter(task => task.style !== "complete");
    setTasklist(remainingTasks);
    
    try {
      const deletePromises = completedTasks.map(task => 
        deleteDoc(doc(db, "shoppinglist", task.id))
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting completed tasks:", error);
      setTasklist(previousTasklist);
      alert("Failed to delete completed items. Please try again.");
    }
  }

  // ======================================
  // UTILITY: Sort tasks by selected mode
  // ======================================
  function getSortedTasks() {
    const sorted = [...tasklist];
    
    if (sortMode === 'importance') {
      // hot > cool > complete
      const priority = { hot: 1, cool: 2, complete: 3 };
      sorted.sort((a, b) => (priority[a.style] || 2) - (priority[b.style] || 2));
    } else if (sortMode === 'chronological') {
      // Sort by createdAt (newest first)
      sorted.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
    } else if (sortMode === 'user') {
      // Sort by created_by
      sorted.sort((a, b) => (a.created_by || '').localeCompare(b.created_by || ''));
    }
    
    return sorted;
  }

  // tasklist --> listItems UI component
  const sortedTasks = getSortedTasks();
  const completedCount = tasklist.filter(t => t.style === 'complete').length;
  
  const listItems = sortedTasks.map((task) => (
    <li key={task.id} className={`item-${task.style || 'cool'}`}>
      <span onClick={() => toggleStyle(task.id)} className="item-content" title="Click to change priority">
        {task.content}
      </span>
      <button onClick={() => deletetask(task.id)} className="delete-btn" title="Delete this item">✕</button>
    </li>
  ));
  
  if (loading) {
    return (
      <div>
        <Title />
        <p style={{textAlign: 'center', color: '#9ca3af'}}>Loading...</p>
      </div>
    );
  }
  
  return (
    <div>
      <Title />
      
      {/* User status and sign in/out button */}
      <div className="user-controls">
        {user && (
          <span className="user-info">
            Welcome, {user.displayName || user.email}!
          </span>
        )}
        <button className="sign-in-btn" onClick={handelsignin}>
          {user ? 'Sign Out' : 'Sign In with Google'}
        </button>
      </div>
      
      <input 
        type="text" 
        placeholder='Add new item and press Enter...' 
        onKeyDown={addtask} 
        className="input-box"
        autoFocus
      />
      
      {/* Sort buttons */}
      <div className="sort-controls">
        <button 
          onClick={() => setSortMode('importance')} 
          className={`sort-btn ${sortMode === 'importance' ? 'active' : ''}`}
        >
          Sort by Importance
        </button>
        <button 
          onClick={() => setSortMode('chronological')} 
          className={`sort-btn ${sortMode === 'chronological' ? 'active' : ''}`}
        >
          Sort by Time
        </button>
        <button 
          onClick={() => setSortMode('user')} 
          className={`sort-btn ${sortMode === 'user' ? 'active' : ''}`}
        >
          Sort by User
        </button>
      </div>
      
      {tasklist.length === 0 ? (
        <p style={{textAlign: 'center', color: '#9ca3af', margin: '2rem 0'}}>
          {user ? 'No items yet. Add your first item!' : 'Please sign in to view your shopping list.'}
        </p>
      ) : (
        <ul>{listItems}</ul>
      )}
      
      {/* Action buttons */}
      {tasklist.length > 0 && (
        <div className="action-buttons">
          <button 
            onClick={deleteCompleted} 
            className="delete-completed-btn"
            disabled={completedCount === 0}
            title={completedCount > 0 ? `Delete ${completedCount} completed item(s)` : 'No completed items'}
          >
            Delete Completed {completedCount > 0 && `(${completedCount})`}
          </button>
          <button onClick={clearAll} className="clear-btn" title="Delete all items">
            Clear All ({tasklist.length})
          </button>
        </div>
      )}
    </div>
  );
}

export default App
