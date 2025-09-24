
import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSearchQuery, setSearchSuggestions } from '../../store/searchSlice';
import { Autocomplete, TextField } from '@mui/material';

const SmartSearch: React.FC = () => {
  const dispatch = useAppDispatch();
  const { searchQuery, searchSuggestions } = useAppSelector(state => state.search);
  const [inputValue, setInputValue] = useState(searchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      dispatch(setSearchQuery(inputValue));
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, dispatch]);

  return (
    <Autocomplete
      freeSolo
      options={searchSuggestions.map((option: any) => option.label)}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      renderInput={(params) => <TextField {...params} label="Search" />}
    />
  );
};

export default SmartSearch;
