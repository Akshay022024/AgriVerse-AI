// Community.jsx - Community and alerts section for Agriverse
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase'; // Importing your existing Firebase setup
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './Community.css';

// Icons - Import as needed
import { Send, Image, ThumbsUp, MessageSquare, AlertTriangle, AlertCircle, X, Calendar, Clock, ChevronDown, Search, Filter, Users, Rss } from 'lucide-react';

const Community = () => {
  // State variables
  const [posts, setPosts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [activeTab, setActiveTab] = useState('community');
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postTags, setPostTags] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddPost, setShowAddPost] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // Fetch agricultural news from RSS feed or API
  const fetchAgriNews = async () => {
    try {
      // Get news from Firestore collection (pre-populated from a server-side function)
      const newsSnapshot = await getDocs(
        query(collection(db, "agriNews"), orderBy("publishedAt", "desc"), limit(10))
      );
      
      const newsData = newsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setNewsItems(newsData);
    } catch (error) {
      console.error("Error fetching agricultural news:", error);
    }
  };

  // Fetch emergency alerts
  const fetchAlerts = async () => {
    try {
      const alertsSnapshot = await getDocs(
        query(collection(db, "alerts"), 
          where("active", "==", true),
          orderBy("createdAt", "desc"), 
          limit(5))
      );
      
      const alertsData = alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAlerts(alertsData);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    }
  };

  // Fetch community posts
  const fetchPosts = async () => {
    setLoading(true);
    try {
      let postsQuery;
      
      if (filter === 'recent') {
        postsQuery = query(collection(db, "communityPosts"), orderBy("timestamp", "desc"), limit(20));
      } else if (filter === 'popular') {
        postsQuery = query(collection(db, "communityPosts"), orderBy("likes", "desc"), limit(20));
      } else if (filter === 'my') {
        if (!auth.currentUser) {
          setPosts([]);
          setLoading(false);
          return;
        }
        postsQuery = query(
          collection(db, "communityPosts"), 
          where("authorId", "==", auth.currentUser.uid),
          orderBy("timestamp", "desc")
        );
      }
      
      const postsSnapshot = await getDocs(postsQuery);
      
      const postsData = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to JS Date
        timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
      }));
      
      setPosts(postsData);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setError("Failed to load community posts. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit a new post
  const handleSubmitPost = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (!postTitle.trim()) {
      setError("Please enter a post title");
      return;
    }
    
    if (!postContent.trim()) {
      setError("Please enter some content for your post");
      return;
    }
    
    if (!auth.currentUser) {
      setError("You need to be signed in to post");
      return;
    }
    
    setLoading(true);
    
    try {
      let imageUrl = null;
      
      // Upload image if selected
      if (selectedImage) {
        const storage = getStorage();
        const imageRef = ref(storage, `community-posts/${auth.currentUser.uid}/${Date.now()}-${selectedImage.name}`);
        
        await uploadBytes(imageRef, selectedImage);
        imageUrl = await getDownloadURL(imageRef);
      }
      
      // Prepare tags array
      const tagsArray = postTags.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Get user display name
      const userName = auth.currentUser.displayName || "Anonymous User";
      
      // Create post document
      const postData = {
        title: postTitle.trim(),
        content: postContent.trim(),
        imageUrl: imageUrl,
        tags: tagsArray,
        authorId: auth.currentUser.uid,
        authorName: userName,
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0,
        userLikes: []
      };
      
      await addDoc(collection(db, "communityPosts"), postData);
      
      // Reset form
      setPostTitle('');
      setPostContent('');
      setPostTags('');
      removeImage();
      setSuccessMessage("Your post has been shared with the community!");
      
      // Refresh posts to include the new one
      fetchPosts();
      
      // Close the add post form
      setShowAddPost(false);
      
      // Scroll to top to see new post
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error("Error creating post:", error);
      setError("Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle liking a post
  const handleLikePost = async (postId) => {
    if (!auth.currentUser) {
      setError("You need to be signed in to like posts");
      return;
    }
    
    try {
      const userId = auth.currentUser.uid;
      const postRef = doc(db, "communityPosts", postId);
      
      // Find the post in our local state
      const postIndex = posts.findIndex(post => post.id === postId);
      if (postIndex === -1) return;
      
      const post = posts[postIndex];
      const userLikes = post.userLikes || [];
      
      // Check if user already liked the post
      const alreadyLiked = userLikes.includes(userId);
      
      // Create a new posts array with updated like count
      const updatedPosts = [...posts];
      
      if (alreadyLiked) {
        // Unlike
        updatedPosts[postIndex] = {
          ...post,
          likes: Math.max(0, post.likes - 1),
          userLikes: userLikes.filter(id => id !== userId)
        };
        
        // Update in Firestore
        await updateDoc(postRef, {
          likes: Math.max(0, post.likes - 1),
          userLikes: userLikes.filter(id => id !== userId)
        });
      } else {
        // Like
        updatedPosts[postIndex] = {
          ...post,
          likes: (post.likes || 0) + 1,
          userLikes: [...userLikes, userId]
        };
        
        // Update in Firestore
        await updateDoc(postRef, {
          likes: (post.likes || 0) + 1,
          userLikes: [...userLikes, userId]
        });
      }
      
      // Update local state
      setPosts(updatedPosts);
      
    } catch (error) {
      console.error("Error updating like:", error);
    }
  };

  // Delete a post (only allowed for author)
  const handleDeletePost = async (postId, authorId) => {
    if (!auth.currentUser || auth.currentUser.uid !== authorId) {
      setError("You can only delete your own posts");
      return;
    }
    
    if (window.confirm("Are you sure you want to delete this post? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "communityPosts", postId));
        
        // Remove from local state
        setPosts(posts.filter(post => post.id !== postId));
        setSuccessMessage("Post deleted successfully");
      } catch (error) {
        console.error("Error deleting post:", error);
        setError("Failed to delete post. Please try again.");
      }
    }
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return "";
    
    const now = new Date();
    const diff = now - date;
    
    // Less than a day
    if (diff < 86400000) {
      // Less than an hour
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
      } else {
        const hours = Math.floor(diff / 3600000);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      }
    } else if (diff < 172800000) { // Less than 2 days
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Check if a post is liked by current user
  const isPostLikedByUser = (post) => {
    if (!auth.currentUser || !post.userLikes) return false;
    return post.userLikes.includes(auth.currentUser.uid);
  };

  // Filter posts by search term
  const getFilteredPosts = () => {
    if (!searchTerm.trim()) return posts;
    
    const term = searchTerm.toLowerCase().trim();
    return posts.filter(post => 
      post.title.toLowerCase().includes(term) || 
      post.content.toLowerCase().includes(term) ||
      post.tags.some(tag => tag.toLowerCase().includes(term)) ||
      post.authorName.toLowerCase().includes(term)
    );
  };

  // Handle search input change
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Toggle add post form
  const toggleAddPost = () => {
    setShowAddPost(!showAddPost);
    setError('');
    setSuccessMessage('');
  };

  // Authentication listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    
    return () => unsubscribe();
  }, []);

  // Fetch data on initial load and when filters change
  useEffect(() => {
    if (activeTab === 'community') {
      fetchPosts();
    } else if (activeTab === 'alerts') {
      fetchAlerts();
    } else if (activeTab === 'news') {
      fetchAgriNews();
    }
  }, [activeTab, filter]);

  return (
    <div className="community-container" ref={scrollRef}>
      <div className="community-header">
        <h1>Agriverse Community Hub</h1>
        <p>Connect, share knowledge, and stay informed with fellow farmers</p>
      </div>
      
      {error && <div className="error-message"><AlertCircle size={16} /> {error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'community' ? 'active' : ''}`} 
          onClick={() => setActiveTab('community')}
        >
          <Users size={18} />
          Community Posts
        </button>
        <button 
          className={`tab ${activeTab === 'alerts' ? 'active' : ''}`} 
          onClick={() => setActiveTab('alerts')}
        >
          <AlertTriangle size={18} />
          Alerts
        </button>
        <button 
          className={`tab ${activeTab === 'news' ? 'active' : ''}`} 
          onClick={() => setActiveTab('news')}
        >
          <Rss size={18} />
          Agri News
        </button>
      </div>
      
      {activeTab === 'community' && (
        <div className="community-section">
          <div className="community-actions">
            <div className="search-box">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search posts..." 
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            
            <div className="filter-dropdown">
              <span>Filter: </span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                {currentUser && <option value="my">My Posts</option>}
              </select>
            </div>
            
            {currentUser ? (
              <button className="create-post-btn" onClick={toggleAddPost}>
                {showAddPost ? "Cancel" : "Share a Post"}
              </button>
            ) : (
              <div className="sign-in-prompt">Sign in to share posts</div>
            )}
          </div>
          
          {showAddPost && currentUser && (
            <div className="create-post-form">
              <h3>Share with the Community</h3>
              <form onSubmit={handleSubmitPost}>
                <div className="form-group">
                  <label htmlFor="postTitle">Title</label>
                  <input 
                    type="text" 
                    id="postTitle" 
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Title of your post"
                    maxLength={100}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="postContent">Content</label>
                  <textarea 
                    id="postContent" 
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Share your insights, questions, or updates..."
                    rows={5}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="postTags">Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    id="postTags" 
                    value={postTags}
                    onChange={(e) => setPostTags(e.target.value)}
                    placeholder="e.g. irrigation, corn, soil health"
                  />
                </div>
                
                <div className="form-group">
                  <label>Add Image (optional)</label>
                  <div className="image-upload-container">
                    <input 
                      type="file" 
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      className="file-input"
                    />
                    <button 
                      type="button" 
                      className="upload-btn"
                      onClick={() => fileInputRef.current.click()}
                    >
                      <Image size={16} /> Choose Image
                    </button>
                    
                    {imagePreview && (
                      <div className="image-preview">
                        <img src={imagePreview} alt="Preview" />
                        <button 
                          type="button" 
                          className="remove-image-btn"
                          onClick={removeImage}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="submit-post-btn" 
                    disabled={loading}
                  >
                    {loading ? "Posting..." : "Post to Community"}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="posts-container">
            {loading && <div className="loading">Loading posts...</div>}
            
            {!loading && getFilteredPosts().length === 0 && (
              <div className="no-posts">
                {searchTerm ? 
                  "No posts match your search criteria" : 
                  "No posts yet. Be the first to share!"}
              </div>
            )}
            
            {getFilteredPosts().map(post => (
              <div className="post-card" key={post.id}>
                <div className="post-header">
                  <div className="post-meta">
                    <span className="author-name">{post.authorName}</span>
                    <span className="post-date">
                      <Clock size={14} />
                      {formatDate(post.timestamp)}
                    </span>
                  </div>
                  
                  {currentUser && currentUser.uid === post.authorId && (
                    <button 
                      className="delete-post-btn"
                      onClick={() => handleDeletePost(post.id, post.authorId)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                
                <h3 className="post-title">{post.title}</h3>
                
                {post.imageUrl && (
                  <div className="post-image">
                    <img src={post.imageUrl} alt={post.title} />
                  </div>
                )}
                
                <div className="post-content">{post.content}</div>
                
                {post.tags && post.tags.length > 0 && (
                  <div className="post-tags">
                    {post.tags.map((tag, index) => (
                      <span key={index} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}
                
                <div className="post-actions">
                  <button 
                    className={`like-btn ${isPostLikedByUser(post) ? 'liked' : ''}`}
                    onClick={() => handleLikePost(post.id)}
                  >
                    <ThumbsUp size={16} /> 
                    <span>{post.likes || 0}</span>
                  </button>
                  
                  <button className="comment-btn">
                    <MessageSquare size={16} />
                    <span>{post.comments || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeTab === 'alerts' && (
        <div className="alerts-section">
          <div className="section-header">
            <h2>Emergency Alerts & Notifications</h2>
            <p>Important updates affecting your agricultural area</p>
          </div>
          
          {alerts.length === 0 ? (
            <div className="no-alerts">
              <AlertCircle size={32} />
              <p>No active alerts at this time</p>
            </div>
          ) : (
            <div className="alerts-container">
              {alerts.map(alert => (
                <div 
                  className={`alert-card ${alert.severity}`} 
                  key={alert.id}
                >
                  <div className="alert-header">
                    <div className="alert-type">
                      <AlertTriangle size={20} />
                      <span>{alert.type}</span>
                    </div>
                    <div className="alert-date">
                      {alert.createdAt ? new Date(alert.createdAt.seconds * 1000).toLocaleDateString() : ""}
                    </div>
                  </div>
                  
                  <h3>{alert.title}</h3>
                  <p>{alert.description}</p>
                  
                  {alert.recommendations && (
                    <div className="alert-recommendations">
                      <h4>Recommendations:</h4>
                      <p>{alert.recommendations}</p>
                    </div>
                  )}
                  
                  {alert.affectedAreas && (
                    <div className="affected-areas">
                      <span>Affected Areas:</span> {alert.affectedAreas}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'news' && (
        <div className="news-section">
          <div className="section-header">
            <h2>Agricultural News & Updates</h2>
            <p>The latest in farming techniques, market trends, and agricultural policy</p>
          </div>
          
          {newsItems.length === 0 ? (
            <div className="no-news">
              <p>Loading news...</p>
            </div>
          ) : (
            <div className="news-container">
              {newsItems.map(news => (
                <div className="news-card" key={news.id}>
                  {news.imageUrl && (
                    <div className="news-image">
                      <img src={news.imageUrl} alt={news.title} />
                    </div>
                  )}
                  
                  <div className="news-content">
                    <div className="news-date">
                      <Calendar size={14} />
                      {news.publishedAt ? new Date(news.publishedAt.seconds * 1000).toLocaleDateString() : ""}
                    </div>
                    
                    <h3>{news.title}</h3>
                    <p>{news.summary}</p>
                    
                    {news.source && (
                      <div className="news-source">
                        Source: {news.source}
                      </div>
                    )}
                    
                    {news.url && (
                      <a 
                        href={news.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="read-more"
                      >
                        Read Full Article
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Community;