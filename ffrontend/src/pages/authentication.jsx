import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material'; // You might need Alert too if you want custom snackbar messages

const defaultTheme = createTheme();

export default function Authentication() {
    const [username, setUsername] = React.useState(''); // Initialize with empty string
    const [password, setPassword] = React.useState(''); // Initialize with empty string
    const [name, setName] = React.useState(''); // Initialize with empty string
    const [error, setError] = React.useState(''); // Initialize with empty string
    const [message, setMessage] = React.useState(''); // Initialize with empty string

    const [formState, setFormState] = React.useState(0);
    const [open, setOpen] = React.useState(false); // For Snackbar open state

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    const handleSnackbarClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setOpen(false);
    };

    let handleAuth = async () => {
        setError(''); // Clear previous errors
        setMessage(''); // Clear previous messages
        try {
            if (formState === 0) { // Login
                const result = await handleLogin(username, password);
                // Assuming handleLogin returns a success message or redirects
                console.log("Login successful:", result);
                setMessage("Login successful!");
                setOpen(true);
                // Optionally redirect or handle successful login UI
            } else if (formState === 1) { // Register
                const result = await handleRegister(name, username, password);
                console.log("Registration successful:", result);
                setUsername("");
                setPassword(""); // Clear password field after registration attempt
                setName(""); // Clear name field after registration attempt
                setMessage(result?.message || "Registration successful! Please login."); // Access message safely
                setOpen(true);
                setError(""); // Clear any previous registration errors
                setFormState(0); // Switch to login form after successful registration
            }
        } catch (err) {
            console.error("Authentication Error:", err); // Log the full error object for debugging

            let displayMessage = "An unexpected error occurred. Please try again.";

            if (err.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx (e.g., 400, 401, 404, 500)
                displayMessage = err.response.data?.message || `Server Error: ${err.response.status}`;
            } else if (err.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser
                // This covers net::ERR_CONNECTION_REFUSED
                displayMessage = "Network error: Could not connect to the server. Please ensure the backend is running and accessible.";
            } else {
                // Something happened in setting up the request that triggered an Error
                displayMessage = err.message || "An error occurred while preparing the request.";
            }

            setError(displayMessage);
            setOpen(true); // Show snackbar for errors too
            setMessage(displayMessage); // Use the same message for Snackbar
        }
    };

    return (
        <ThemeProvider theme={defaultTheme}>
            <Grid container component="main" sx={{ height: '100vh' }}>
                <CssBaseline />
                <Grid
                    item
                    xs={false}
                    sm={4}
                    md={7}
                    sx={{
                        backgroundImage: 'url(https://source.unsplash.com/random?wallpapers)',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: (t) =>
                            t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />
                <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
                    <Box
                        sx={{
                            my: 8,
                            mx: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                            <LockOutlinedIcon />
                        </Avatar>

                        <div>
                            <Button variant={formState === 0 ? "contained" : ""} onClick={() => { setFormState(0) }}>
                                Sign In
                            </Button>
                            <Button variant={formState === 1 ? "contained" : ""} onClick={() => { setFormState(1) }}>
                                Sign Up
                            </Button>
                        </div>

                        <Box component="form" noValidate sx={{ mt: 1 }}>
                            {formState === 1 ? (
                                <TextField
                                    margin="normal"
                                    required
                                    fullWidth
                                    id="name" // Changed id to 'name' for clarity
                                    label="Full Name"
                                    name="name" // Changed name to 'name'
                                    value={name}
                                    autoFocus
                                    onChange={(e) => setName(e.target.value)}
                                />
                            ) : <></>}

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                value={password}
                                type="password"
                                onChange={(e) => setPassword(e.target.value)}
                                id="password"
                            />

                            {/* Display error messages more prominently if you like, or just rely on Snackbar */}
                            {error && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{error}</Typography>}

                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }}
                                onClick={handleAuth}
                            >
                                {formState === 0 ? "Login " : "Register"}
                            </Button>
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Snackbar
                open={open}
                autoHideDuration={6000} // Increased duration for error messages
                onClose={handleSnackbarClose}
                message={message} // This will show the combined message
                // You might want to add action buttons for more complex snackbars
            />

        </ThemeProvider>
    );
}